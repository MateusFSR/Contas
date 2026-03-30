// ==========================================================================
// CONFIGURAÇÕES GERAIS E BANCO DE DADOS (SUPABASE)
// ==========================================================================
const SUPABASE_URL = "https://amqbggvxcyutlzubadio.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcWJnZ3Z4Y3l1dGx6dWJhZGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzc1NDksImV4cCI6MjA5MDIxMzU0OX0.PtlDWAmK7wCmFAs4QZIv3CSnlbqS11v8DCXw6K7NTvg"; 
const NOME_USUARIO = "mateusfsr";

const MESES_ANO = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];

// Estrutura: dados[ano][mes] = [...]  (ex.: dados["2026"]["Janeiro"])
function migrarEstruturaLegada(obj) {
    if (!obj || typeof obj !== "object") {
        return { [String(new Date().getFullYear())]: Object.fromEntries(MESES_ANO.map((m) => [m, []])) };
    }
    const keys = Object.keys(obj);
    if (keys.length === 0) {
        return { [String(new Date().getFullYear())]: Object.fromEntries(MESES_ANO.map((m) => [m, []])) };
    }
    const k0 = keys[0];
    if (/^\d{4}$/.test(k0) && obj[k0] && typeof obj[k0] === "object") {
        const inner = Object.keys(obj[k0]);
        if (inner.some((ik) => MESES_ANO.includes(ik))) {
            return obj;
        }
    }
    if (MESES_ANO.some((m) => Object.prototype.hasOwnProperty.call(obj, m))) {
        return { [String(new Date().getFullYear())]: { ...obj } };
    }
    return { [String(new Date().getFullYear())]: Object.fromEntries(MESES_ANO.map((m) => [m, []])) };
}

function parsePayloadNuvem(raw) {
    if (!raw || typeof raw !== "object") return { data: null, updatedAt: 0 };
    if (raw.data !== undefined && raw.updatedAt != null) {
        return { data: raw.data, updatedAt: Number(raw.updatedAt) || 0 };
    }
    return { data: raw, updatedAt: 0 };
}

function getLocalUpdatedAt() {
    return parseInt(localStorage.getItem("dadosUpdatedAt") || "0", 10);
}

function persistDadosLocal(ts) {
    const t = ts != null ? ts : Date.now();
    localStorage.setItem("dados", JSON.stringify(dados));
    localStorage.setItem("dadosUpdatedAt", String(t));
}

function loadDadosInicialLocal() {
    const raw = localStorage.getItem("dados");
    let parsed = null;
    try {
        parsed = raw ? JSON.parse(raw) : null;
    } catch {
        parsed = null;
    }
    const d = migrarEstruturaLegada(parsed);
    if (raw && localStorage.getItem("dadosUpdatedAt") == null) {
        localStorage.setItem("dadosUpdatedAt", String(Date.now()));
    }
    return d;
}

function getAnoSelecionado() {
    const el = document.getElementById("filtroAno");
    if (el && el.value) return String(el.value);
    return String(new Date().getFullYear());
}

function ensureAnoMes(ano, mes) {
    if (!dados[ano]) dados[ano] = {};
    if (!dados[ano][mes]) dados[ano][mes] = [];
    return dados[ano][mes];
}

function modalShow(id, show) {
    const el = document.getElementById(id);
    if (!el) return;
    el.style.display = show ? "flex" : "none";
    el.setAttribute("aria-hidden", show ? "false" : "true");
}

let dados = loadDadosInicialLocal();

let grafDistribuicao = null;
let grafCategoria = null;
let grafEvolucao = null;

// ==========================================================================
// FUNÇÕES DE AUTENTICAÇÃO E NAVEGAÇÃO
// ==========================================================================
// ==========================================================================
// SEGURANÇA E ACESSO
// ==========================================================================

function login() {
    // Pegamos os valores e já tratamos o usuário para minúsculo
    const userRaw = document.getElementById("usuario")?.value || "";
    const user = userRaw.toLowerCase().trim(); // MateusFSR vira mateusfsr
    
    const pass = document.getElementById("senha")?.value;
    const erroMsg = document.getElementById("erro");

    // Validação com a nova senha numeral
    if (user === "mateusfsr" && pass === "628387") {
        localStorage.setItem("logado", "true");
        
        // Feedback visual de sucesso antes de redirecionar
        if (erroMsg) {
            erroMsg.style.color = "#2ecc71";
            erroMsg.innerText = "Acesso autorizado! Entrando...";
        }
        
        setTimeout(() => {
            window.location.href = "painel.html";
        }, 800);
        
    } else {
        if (erroMsg) {
            erroMsg.style.color = "#ff4d4d";
            erroMsg.innerText = "Usuário ou senha incorretos!";
            
            // Limpa o campo de senha para nova tentativa
            document.getElementById("senha").value = "";
            
            setTimeout(() => { erroMsg.innerText = ""; }, 3000);
        }
    }
}

function logout() {
    localStorage.removeItem("logado");
    window.location.href = "index.html"; // Volta para a tela de login
}

function verificarAcesso() {
    const estaLogado = localStorage.getItem("logado") === "true";
    const naPaginaDeLogin = window.location.pathname.endsWith("index.html") || window.location.pathname === "/";

    // Se NÃO está logado e NÃO está no login, expulsa
    if (!estaLogado && !naPaginaDeLogin) {
        window.location.href = "index.html";
    }
}

// ==========================================================================
// MONITOR DE INATIVIDADE (5 MINUTOS)
// ==========================================================================
let idleTimer;

function resetIdleTimer() {
    clearTimeout(idleTimer);
    
    // Só ativa o timer se o usuário estiver logado e fora da tela de login
    if (localStorage.getItem("logado") === "true" && !window.location.pathname.endsWith("index.html")) {
        idleTimer = setTimeout(() => {
            console.log("Inatividade detectada...");
            logout();
        }, 300000); // 5 minutos
    }
}

// Escutando eventos de interação
window.onmousemove = resetIdleTimer;
window.onmousedown = resetIdleTimer;
window.onkeypress = resetIdleTimer;
window.ontouchstart = resetIdleTimer;

// ==========================================================================
// COMUNICAÇÃO COM SUPABASE (PERSISTÊNCIA REMOTA)
// ==========================================================================
async function carregarDadosDoBanco() {
    console.log("🔄 Sincronizando com Supabase...");
    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}&select=dados_json`, {
            method: 'GET',
            headers: {
                "apikey": SUPABASE_KEY,
                "Authorization": `Bearer ${SUPABASE_KEY}`,
                "Content-Type": "application/json"
            }
        });

        if (!response.ok) throw new Error("Erro na requisição");

        const resultado = await response.json();
        if (resultado && resultado.length > 0) {
            const { data: rawData, updatedAt: remoteTs } = parsePayloadNuvem(resultado[0].dados_json);
            const remoteData = migrarEstruturaLegada(rawData);
            const localTs = getLocalUpdatedAt();

            if (remoteTs > localTs) {
                dados = remoteData;
                persistDadosLocal(remoteTs);
                console.log("✅ Dados da nuvem aplicados (mais recentes).");
            } else if (localTs > remoteTs) {
                console.log("📤 Dados locais mais recentes; enviando para a nuvem.");
                await salvarNoBanco();
            } else {
                dados = remoteData;
                persistDadosLocal(remoteTs || Date.now());
                console.log("✅ Dados sincronizados.");
            }
        }
        render();
        return true;
    } catch (error) {
        console.error("❌ Falha ao carregar dados:", error);
        mostrarToastErro("Não foi possível atualizar da nuvem. Usando dados locais.");
        render();
        return false;
    }
}

async function salvarNoBanco() {
    const btn = document.getElementById("btnSalvar");
    
    // 1. Estado de Carregamento no Botão
    if (btn) {
        btn.innerHTML = "<span>⏳</span><br><small>Salvando</small>";
        btn.disabled = true;
    }

    try {
        // 2. Verifica se o usuário já tem dados no banco
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}`, {
            headers: { 
                "apikey": SUPABASE_KEY, 
                "Authorization": `Bearer ${SUPABASE_KEY}` 
            }
        });
        
        const existe = await checkRes.json();
        const updatedAt = Date.now();
        const envelope = { data: dados, updatedAt };
        const payload = { usuario: NOME_USUARIO, dados_json: envelope };
        let finalRes;

        // 3. Lógica de PATCH (Atualizar) ou POST (Criar novo)
        if (existe && existe.length > 0) {
            finalRes = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}`, {
                method: 'PATCH',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json",
                    "Prefer": "return=minimal"
                },
                body: JSON.stringify({ dados_json: envelope })
            });
        } else {
            finalRes = await fetch(`${SUPABASE_URL}/rest/v1/financas`, {
                method: 'POST',
                headers: {
                    "apikey": SUPABASE_KEY,
                    "Authorization": `Bearer ${SUPABASE_KEY}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
        }

        // 4. Tratamento de Sucesso
        if (finalRes.ok) {
            mostrarToastSucesso("Sincronizado com a nuvem!");
            persistDadosLocal(updatedAt);
        } else {
            throw new Error("Erro no servidor");
        }

    } catch (error) {
        console.error(error);
        mostrarToastErro("Erro ao salvar na nuvem. Verifique sua conexão.");
    } finally {
        // 5. Restaura o estado original do botão
        if (btn) {
            btn.innerHTML = "<span>☁️</span><br><small>Salvar</small>";
            btn.disabled = false;
        }
    }
}

// Inicializa os modelos de fixos (se não houver no storage, usa um padrão vazio)
let modelosFixos = JSON.parse(localStorage.getItem("tws_modelos_fixos")) || [
    { desc: "Internet", valor: 100.00, cat: "Necessidades", origem: "Pagamento" },
    { desc: "Copel", valor: 180.00, cat: "Necessidades", origem: "Pagamento" }
];

// Abre o gerenciador
function abrirGerenciadorFixos() {
    modalShow("modalConfigFixos", true);
    renderizarListaModelos();
}

function fecharModalFixos() {
    modalShow("modalConfigFixos", false);
}

// Renderiza a lista dentro do modal para você excluir ou ver o que tem
function renderizarListaModelos() {
    const container = document.getElementById("listaModelosFixos");
    container.innerHTML = modelosFixos.map((m, index) => `
        <div style="display: flex; justify-content: space-between; align-items: center; background: #252525; padding: 10px; border-radius: 8px; margin-bottom: 5px;">
            <div>
                <span style="display:block; font-size: 13px;">${m.desc}</span>
                <span style="font-size: 11px; color: var(--inter-orange);">R$ ${m.valor.toFixed(2)}</span>
            </div>
            <button onclick="removerModeloFixo(${index})" class="btn-clear" style="color: #ff4d4d;">✕</button>
        </div>
    `).join('');
}

function adicionarNovoModeloFixo() {
    const desc = document.getElementById("fixoDesc").value;
    const valor = parseFloat(document.getElementById("fixoValor").value);

    if (desc && valor) {
        modelosFixos.push({ desc, valor, cat: "Necessidades", origem: "Pagamento" });
        localStorage.setItem("tws_modelos_fixos", JSON.stringify(modelosFixos));
        document.getElementById("fixoDesc").value = "";
        document.getElementById("fixoValor").value = "";
        renderizarListaModelos();
    }
}

function removerModeloFixo(index) {
    modelosFixos.splice(index, 1);
    localStorage.setItem("tws_modelos_fixos", JSON.stringify(modelosFixos));
    renderizarListaModelos();
}

function abrirConfirmacaoFixos() {
    modalShow("modalConfirmarFixos", true);
}

function fecharModalConfirmarFixos() {
    modalShow("modalConfirmarFixos", false);
}

async function lancarContasFixas() {
    const mes = document.getElementById("filtroMes").value;

    if (modelosFixos.length === 0) {
        mostrarToastErro("Nenhum modelo cadastrado.");
        return;
    }

    fecharModalConfirmarFixos();

    // REMOVIDO: if (confirm(...))
    // NOVA LÓGICA: Executa direto ou você pode abrir um modal de "Processando"
    
    const ano = getAnoSelecionado();
    modelosFixos.forEach(c => {
        ensureAnoMes(ano, mes).push({
            id: Date.now() + Math.random(),
            desc: c.desc,
            valor: c.valor,
            cat: c.cat,
            origem: c.origem,
            pago: false,
            dataCriacao: new Date().toISOString()
        });
    });

    render();
    await salvarDados();
    
    // Feedback visual que substitui a necessidade do popup
    mostrarToastSucesso(`${modelosFixos.length} gastos fixos lançados!`);
    
    // Se o menu de opções estiver aberto, fecha ele
    const menu = document.getElementById("menuFixosOpcoes");
    const btnGear = document.getElementById("btnMasterFixos");
    if (menu) {
        menu.classList.remove("aberto");
        menu.setAttribute("aria-hidden", "true");
    }
    if (btnGear) {
        btnGear.setAttribute("aria-expanded", "false");
        btnGear.style.transform = "";
        btnGear.style.background = "";
    }
}

// 1. Lógica do Modo Furtivo Atualizada
let modoFurtivo = localStorage.getItem("modoFurtivo") === "true";

function toggleModoFurtivo() {
    modoFurtivo = !modoFurtivo;
    localStorage.setItem("modoFurtivo", modoFurtivo);
    
    // Aplica o efeito visual imediatamente sem precisar mudar de mês
    aplicarModoFurtivo();
}

function aplicarModoFurtivo() {
    const btnOlho = document.getElementById("btnFurtivo");
    if (btnOlho) btnOlho.innerText = modoFurtivo ? "👁️‍🗨️" : "👁️";

    // Seleciona todos os elementos que devem ser borrados
    // IDs dos saldos + classes de valores na tabela
    const seletores = "#vTotal, #vPag, #vAdi, .limite-valor, .valor-tabela, .input-valor";
    const elementos = document.querySelectorAll(seletores);

    elementos.forEach(el => {
        if (modoFurtivo) {
            el.classList.add("blur-effect");
        } else {
            el.classList.remove("blur-effect");
        }
    });
}

// ==========================================================================
// LÓGICA DE CRUD
// ==========================================================================
function adicionar() {
    const desc = document.getElementById("desc");
    const valor = document.getElementById("valor");
    const cat = document.getElementById("cat"); 
    const origem = document.getElementById("origem"); 
    const mes = document.getElementById("filtroMes").value;
    const check = document.getElementById("checkPrevisto"); // Captura o elemento

    if (!desc.value || !valor.value) {
        mostrarToastErro("Preencha a descrição e o valor.");
        return;
    }

    // Se o check existe e está marcado, pago = false. Caso contrário, pago = true.
    const statusPago = check ? !check.checked : true;

    const novoItem = {
        id: Date.now(),
        desc: desc.value,
        valor: parseFloat(valor.value),
        cat: cat.value,
        origem: origem.value,
        pago: statusPago, 
        dataCriacao: new Date().toISOString()
    };

    const ano = getAnoSelecionado();
    ensureAnoMes(ano, mes).push(novoItem);
    
    // Limpeza
    desc.value = "";
    valor.value = "";
    if (check) check.checked = false; 
    
    persistDadosLocal(Date.now());
    render();
}

let indexParaRemover = null;

function fecharConfirmacao() {
    modalShow("modalConfirmarExclusao", false);
    indexParaRemover = null;
}

let timeoutAutoSave;

function editarCampo(index, campo, novoValor) {
    const mes = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    if (!dados[ano] || !dados[ano][mes]) return;
    if (campo === "valor") {
        dados[ano][mes][index][campo] = parseFloat(novoValor) || 0;
    } else {
        dados[ano][mes][index][campo] = novoValor;
    }
    persistDadosLocal(Date.now());
    
    // Lógica de Auto-salvamento com delay de 1.5s para não travar o banco
    clearTimeout(timeoutAutoSave);
    timeoutAutoSave = setTimeout(() => {
        salvarNoBanco();
    }, 1500);
}

// ==========================================================================
// RENDERIZAÇÃO E INTERFACE
// ==========================================================================
function render() {
    const filtroEl = document.getElementById("filtroMes");
    const lista = document.getElementById("lista");
    const resumo = document.getElementById("resumo");
    if (!filtroEl || !lista || !resumo) return;

    if (!filtroEl.value) filtroEl.value = MESES_ANO[new Date().getMonth()];

    const mesAtualNome = filtroEl.value;
    const indexMesAtual = MESES_ANO.indexOf(mesAtualNome);
    const ano = getAnoSelecionado();

    ensureAnoMes(ano, mesAtualNome);
    const listaMesAtual = dados[ano][mesAtualNome];

    // Ajuste de layout para o header fixo
    const header = document.querySelector(".bank-header-main");
    const containerMain = document.querySelector(".container");
    if (header && containerMain) {
        containerMain.style.marginTop = (header.offsetHeight + 10) + "px";
    }

    let totalEntradas = 0, totalSaidas = 0;
    let pagIn = 0, adiIn = 0;
    let pagOut = 0, adiOut = 0
    let limiteUsadoNoMes = 0;
    
    // 1. CÁLCULOS
    listaMesAtual.forEach(item => {
    const valor = parseFloat(item.valor) || 0;
    const origem = (item.origem || "").toLowerCase();
    const desc = (item.desc || "").toLowerCase();

    // =====================
    // ENTRADAS
    // =====================
    if (item.cat === "Entrada") {
        totalEntradas += valor;

        if (desc.includes("pagamento") || origem.includes("pag")) {
            pagIn += valor;
        }

        if (desc.includes("adiantamento") || origem.includes("adi")) {
            adiIn += valor;
        }
    }

    // =====================
    // SAÍDAS
    // =====================
    else if (item.pago !== false) {
        totalSaidas += valor;

        if (origem.includes("pag")) {
            pagOut += valor;
        }

        if (origem.includes("adi")) {
            adiOut += valor;
        }

        if (item.origem && item.origem.includes("Crédito")) {
            limiteUsadoNoMes += valor;
        }
    }
    });

    const saldoPagamento = pagIn - pagOut;
    const saldoAdiantamento = adiIn - adiOut;

    let totalCaixinhaHistorico = 0;
    for (let i = 0; i <= indexMesAtual; i++) {
        const nomeM = MESES_ANO[i];
        const arr = dados[ano] && dados[ano][nomeM];
        if (arr) {
            arr.forEach(item => { 
                if (item.cat === "Guardar" && item.pago !== false) totalCaixinhaHistorico += item.valor; 
            });
        }
    }

    const limiteDisponivel = totalCaixinhaHistorico - limiteUsadoNoMes;
    const pctUsadoCredito =
        totalCaixinhaHistorico > 0
            ? Math.min((limiteUsadoNoMes / totalCaixinhaHistorico) * 100, 100)
            : 0;
    const pctDisponivelCredito = totalCaixinhaHistorico > 0 ? Math.max(0, 100 - pctUsadoCredito) : 0;
    
    // CORES CORRIGIDAS: Usando variáveis do CSS sem fixar #fff
    const corDinamica = "var(--inter-text)"; 
    const corSuave = "var(--inter-gray)";

    // 2. RENDERIZAÇÃO DO RESUMO
    resumo.innerHTML = `
    <div class="bank-grid">

        <!-- CARD PRINCIPAL -->
        <div class="bank-card full no-padding">
            <div class="resumo-topo">

                <!-- ESQUERDA -->
                <div class="resumo-esquerda">
                    <span class="bank-label">SALDO TOTAL EM CONTA</span>
                    
                    <strong class="bank-value destaque" id="vTotal">
                        R$ 0,00
                    </strong>

                    <div class="acoes-saldo">
                        <button onclick="abrirModal()" class="btn-acao destaque">
                            <span class="icone">›</span>
                            novo lançamento
                        </button>

                        <button onclick="toggleMetasFlutuante()" class="btn-acao">
                            <span class="icone">📊</span>
                            ver metas
                        </button>
                    </div>
                </div>

                <!-- DIREITA -->
                <div class="resumo-direita">
                    <span class="bank-label">LIMITE DISPONÍVEL</span>
                    
                    <strong class="bank-value limite-valor">
                        R$ ${limiteDisponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </strong>

                    <div class="barra-limite" aria-hidden="true">
                        <div class="barra-limite-disponivel" style="width: ${pctDisponivelCredito}%"></div>
                        <div class="barra-limite-usado" style="width: ${pctUsadoCredito}%"></div>
                    </div>
                </div>

            </div>
        </div>

        <!-- CARD INFERIOR -->
        <div class="bank-card resumo-inferior">

            <div class="resumo-item esquerda">
                <span class="bank-label">SALDO PAGAMENTO</span>
                <strong id="vPag">R$ 0,00</strong>
            </div>

            <div class="divisor-vertical"></div>

            <div class="resumo-item direita">
                <span class="bank-label">SALDO ADIANTAMENTO</span>
                <strong id="vAdi">R$ 0,00</strong>
            </div>

        </div>

    </div>
    `;

    // 3. EXTRATO (lista única, ordenada por data mais recente; sem cabeçalhos por dia)
    const agrupadoPorData = {};
    listaMesAtual.forEach(item => {
        const dataKey = item.dataCriacao ? item.dataCriacao.split('T')[0] : new Date().toISOString().split('T')[0];
        if (!agrupadoPorData[dataKey]) agrupadoPorData[dataKey] = [];
        agrupadoPorData[dataKey].push(item);
    });

    const datasOrdenadas = Object.keys(agrupadoPorData).sort((a, b) => new Date(b) - new Date(a));
    const itensExtratoOrdenados = datasOrdenadas.flatMap((data) => agrupadoPorData[data]);

    let htmlExtrato = `
        <div class="bank-card" style="margin-top:20px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: ${corDinamica}">Extrato</h3>
                <span style="color:${corSuave}; font-size:12px">${listaMesAtual.length} lançamentos</span>
            </div>
            <div class="container-extrato">`;

    itensExtratoOrdenados.forEach((item) => {
        const isEntrada = item.cat === "Entrada";
        const isPrevisto = item.pago === false;
        const icones = {"Pessoal": "🛒", "Necessidades": "🏠", "Guardar": "💰", "Entrada": "💵"};
        const icone = icones[item.cat] || "📝";

        htmlExtrato += `
                <div class="item-transacao" onclick="abrirEdicao('${item.id}')" style="display: flex; align-items: center; padding: 12px 0; cursor: pointer; border-bottom: 1px solid var(--inter-border); ${isPrevisto ? 'opacity: 0.5' : ''}">
                    <div class="icone-circulo" style="width: 40px; height: 40px; background: var(--icon-bg); border-radius: 50%; display: flex; justify-content: center; align-items: center; margin-right: 15px; font-size: 18px; border: 1px solid var(--inter-border);">
                        ${icone}
                    </div>
                    <div style="flex-grow: 1;">
                        <div style="font-size: 14px; color: ${corDinamica}">${item.desc}</div>
                        <div style="font-size: 12px; color: ${corSuave}">${item.origem || 'Carteira'}</div>
                    </div>
                    <div style="text-align: right;">
                    <div style="font-size: 14px; font-weight: bold; color: ${isEntrada ? 'var(--green)' : 'var(--red)'}">
                        ${isEntrada ? '' : '-'} R$ ${parseFloat(item.valor).toFixed(2)}
                    </div>
                    ${isPrevisto ? `
                        <button 
                            onclick="confirmarPagamentoDireto(event, '${item.id}')" 
                            style="background: none; border: 1px solid var(--inter-orange); color: var(--inter-orange); font-size: 9px; padding: 2px 5px; border-radius: 4px; cursor: pointer; margin-top: 4px;">
                            PENDENTE
                        </button>
                    ` : ''}
                    </div>
                    <div style="margin-left: 15px; color: var(--inter-orange); font-size: 12px;">❯</div>
                </div>
            `;
    });

    htmlExtrato += `</div></div>`;
    lista.innerHTML = htmlExtrato;

    document.querySelectorAll(".mes-btn").forEach((btn) =>
        btn.classList.toggle("ativo", (btn.dataset.mes || btn.textContent.trim()) === mesAtualNome)
    );
    animarValoresTela(
    totalEntradas - totalSaidas,
    saldoPagamento,
    saldoAdiantamento
    );
    aplicarModoFurtivo();
    ativarDragAndDrop();
}

// FUNÇÃO COMPLEMENTAR PARA O BOTÃO "PAGAR"
async function confirmarPagamento(id) {
    const mes = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    if (!dados[ano] || !dados[ano][mes]) return;
    const item = dados[ano][mes].find(i => i.id == id || i.id === parseFloat(id));
    if (item) {
        item.pago = true;
        item.desc = item.desc.replace("[PREVISTO] ", "");
        persistDadosLocal(Date.now());
        render();
        await salvarDados();
    }
}

// Função auxiliar para não repetir código das metas
function renderizarBlocoMeta(titulo, totalEntrada, gastos) {
    const metasConfig = { Necessidades: 0.4, Pessoal: 0.3, Guardar: 0.3 };
    let html = `<div><h4 style="color:var(--inter-orange); font-size: 12px; margin-bottom: 15px; border-left: 3px solid var(--inter-orange); padding-left: 10px;">${titulo} (R$ ${totalEntrada.toFixed(2)})</h4>`;
    
    for (let cat in metasConfig) {
        const metaValor = totalEntrada * metasConfig[cat];
        const gasto = gastos[cat] || 0;
        const porcentagem = metaValor > 0 ? (gasto / metaValor) * 100 : 0;
        const sobra = metaValor - gasto;

        html += `
            <div style="margin-bottom: 15px;">
                <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 5px;">
                    <span>${cat}</span>
                    <span style="font-weight: bold;">${porcentagem.toFixed(1)}%</span>
                </div>
                <div style="width: 100%; height: 8px; background: #222; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${Math.min(porcentagem, 100)}%; height: 100%; background: ${porcentagem > 100 ? '#ff4d4d' : 'var(--inter-orange)'}; transition: width 0.5s;"></div>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 10px; color: var(--inter-gray); margin-top: 4px;">
                    <span>Gasto: R$ ${gasto.toFixed(2)}</span>
                    <span>Sobra: R$ ${sobra.toFixed(2)}</span>
                </div>
            </div>`;
    }
    return html + `</div>`;
}

// ==========================================================================
// COMPONENTES DE UI E UTILITÁRIOS
// ==========================================================================
function gerarBarraUI(nome, atual, limite) {
    const porcento = limite > 0 ? Math.min((atual / limite) * 100, 100) : 0;
    const corBarra = porcento >= 100 ? "#ff4d4d" : "var(--inter-orange)";
    return `
        <div class="bank-progress-container" style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:4px;">
                <span>${nome}</span><span>${porcento.toFixed(1)}%</span>
            </div>
            <div class="bank-progress-bg" style="height:6px; background:rgba(255,255,255,0.1); border-radius:3px; overflow:hidden;">
                <div class="bank-progress-fill" style="width: ${porcento}%; height:100%; background:${corBarra}; transition:0.5s;"></div>
            </div>
            <div style="display:flex; justify-content:space-between; font-size:10px; color:var(--inter-gray); margin-top:4px;">
                <span>Gasto: R$ ${atual.toFixed(2)}</span><span>Sobra: R$ ${(limite - atual).toFixed(2)}</span>
            </div>
        </div>`;
}

function animarValoresTela(total, pag, adi) {
    const formatar = (v) => "R$ " + v.toLocaleString("pt-BR", { minimumFractionDigits: 2 });
    const vTotal = document.getElementById("vTotal");
    const vPag = document.getElementById("vPag");
    const vAdi = document.getElementById("vAdi");
    if (vTotal) vTotal.innerText = formatar(total);
    if (vPag) vPag.innerText = formatar(pag);
    if (vAdi) vAdi.innerText = formatar(adi);
}

function mudarMes(novoMes) {
    const el = document.getElementById("filtroMes");
    if (el) el.value = novoMes;
    render();
}

function buildMenuMeses() {
    const container = document.getElementById("menuMeses");
    if (!container || container.dataset.built) return;
    container.innerHTML = MESES_ANO.map(
        (m) => `<button type="button" class="mes-btn" data-mes="${m}">${m}</button>`
    ).join("");
    container.dataset.built = "1";
    container.addEventListener("click", (e) => {
        const btn = e.target.closest(".mes-btn");
        if (btn?.dataset.mes) mudarMes(btn.dataset.mes);
    });
}

function applyStoredTheme() {
    if (document.body.classList.contains("login-page")) return;
    const saved = localStorage.getItem("darkMode");
    const useDark = saved === null ? true : saved === "true";
    document.body.classList.toggle("dark-mode", useDark);
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", String(isDark));
}

// ==========================================================================
// MODAIS E DASHBOARD
// ==========================================================================

function abrirModal() {
    modalShow("modalLancamento", true);
    const d = document.getElementById("desc");
    setTimeout(() => d && d.focus(), 0);
}

function fecharModal() {
    modalShow("modalLancamento", false);
}

function mostrarToastSucesso(mensagem) {
    const toast = document.getElementById("toast-sucesso");
    if (!toast) return;
    const msgEl = toast.querySelector(".toast-msg");
    if (mensagem && msgEl) msgEl.textContent = mensagem;
    toast.style.display = "flex";
    toast.style.animation = "slideInRight 0.5s ease forwards";

    setTimeout(() => {
        toast.style.animation = "slideOutRight 0.5s ease forwards";
        setTimeout(() => {
            toast.style.display = "none";
            if (msgEl) msgEl.textContent = "Dados atualizados com êxito.";
        }, 500);
    }, 3000);
}

function mostrarToastErro(mensagem) {
    const toast = document.getElementById("toast-erro");
    if (!toast) return;
    const msgEl = toast.querySelector(".toast-msg");
    if (mensagem && msgEl) msgEl.textContent = mensagem;
    toast.style.display = "flex";
    toast.style.animation = "slideInRight 0.5s ease forwards";

    setTimeout(() => {
        toast.style.animation = "slideOutRight 0.5s ease forwards";
        setTimeout(() => {
            toast.style.display = "none";
            if (msgEl) msgEl.textContent = "Algo deu errado.";
        }, 500);
    }, 4000);
}

function adicionarComModal() {
    const desc = document.getElementById("desc");
    const valor = document.getElementById("valor");
    const cat = document.getElementById("cat"); 
    const origem = document.getElementById("origem"); 
    const mes = document.getElementById("filtroMes").value;
    const check = document.getElementById("checkPrevisto"); 

    if (!desc.value || !valor.value) {
        mostrarToastErro("Preencha a descrição e o valor.");
        return;
    }

    // Se o checkbox está marcado, 'pago' é false.
    const statusPago = check && check.checked ? false : true;

    const novoItem = {
        id: Date.now().toString(), // Usando string para evitar problemas de tipos
        desc: desc.value,
        valor: parseFloat(valor.value),
        cat: cat.value,
        origem: origem.value,
        pago: statusPago, 
        dataCriacao: new Date().toISOString()
    };

    const ano = getAnoSelecionado();
    ensureAnoMes(ano, mes).push(novoItem);
    
    // Limpar e fechar
    desc.value = "";
    valor.value = "";
    if (check) check.checked = false; 
    
    fecharModal(); // Fecha o modal após adicionar
    
    persistDadosLocal(Date.now());
    render();
    if (typeof salvarNoBanco === "function") salvarNoBanco();
}

function abrirDashboard() {
    document.getElementById("dashboardModal").classList.add("ativo");
    setTimeout(renderizarGraficosDashboard, 100);
}
function fecharDashboard() { document.getElementById("dashboardModal").classList.remove("ativo"); }

function renderizarGraficosDashboard() {
    const mes = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    const dMes = (dados[ano] && dados[ano][mes]) || [];
    let cats = { Necessidades: 0, Pessoal: 0, Guardar: 0 };
    dMes.forEach(i => { if(cats[i.cat] !== undefined) cats[i.cat] += i.valor; });

    if (grafCategoria) grafCategoria.destroy();
    const ctx = document.getElementById('graficoCategoria')?.getContext('2d');
    if (ctx) {
        grafCategoria = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: Object.keys(cats),
                datasets: [{ label: 'Gastos por Categoria', data: Object.values(cats), backgroundColor: '#FF7A00' }]
            }
        });
    }
}

// ==========================================================================
// IMPORT/EXPORT E DRAG
// ==========================================================================
function exportarExcel() {
    let rows = [];
    const anos = Object.keys(dados).sort();
    for (const ano of anos) {
        const porMes = dados[ano];
        if (!porMes || typeof porMes !== "object") continue;
        for (const m of MESES_ANO) {
            if (!porMes[m] || !porMes[m].length) continue;
            porMes[m].forEach(item => {
                rows.push({
                    "Ano": ano,
                    "Mês": m,
                    "Descrição": item.desc,
                    "Valor": item.valor,
                    "Categoria": item.cat,
                    "Origem": item.origem
                });
            });
        }
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Finanças");
    XLSX.writeFile(wb, `Financeiro_Inter.xlsx`);
}

function importarExcel(input) {
    const file = input.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        let novosDados = {};
        json.forEach(row => {
            const m = row["Mês"];
            if (!m) return;
            const ano = row["Ano"] != null && row["Ano"] !== "" ? String(row["Ano"]) : getAnoSelecionado();
            if (!novosDados[ano]) novosDados[ano] = {};
            if (!novosDados[ano][m]) novosDados[ano][m] = [];
            novosDados[ano][m].push({
                id: Date.now() + Math.random(),
                desc: row["Descrição"],
                valor: parseFloat(row["Valor"]),
                cat: row["Categoria"],
                origem: row["Origem"],
                pago: true,
                dataCriacao: new Date().toISOString()
            });
        });
        dados = migrarEstruturaLegada(novosDados);
        persistDadosLocal(Date.now());
        render();
        if (typeof salvarNoBanco === "function") salvarNoBanco();
    };
    reader.readAsArrayBuffer(file);
}

function ativarDragAndDrop() {
    const container = document.querySelector(".container-extrato");
    if (!container) return;

    const rows = container.querySelectorAll(".item-transacao");
    let draggedId = null;

    rows.forEach((row) => {
        row.setAttribute("draggable", true);

        row.addEventListener("dragstart", (e) => {
            // Em vez de index, usamos o ID único que já está no seu HTML
            // Note que no seu render() você passa abrirEdicao('ID'), vamos capturar esse ID
            const onclickAttr = e.currentTarget.getAttribute("onclick");
            draggedId = onclickAttr.match(/'([^']+)'/)[1]; 
            
            e.currentTarget.classList.add("dragging");
            e.dataTransfer.effectAllowed = "move";
        });

        row.addEventListener("dragend", (e) => {
            e.currentTarget.classList.remove("dragging");
        });

        row.addEventListener("dragover", (e) => {
            e.preventDefault();
        });

        row.addEventListener("drop", async (e) => {
            e.preventDefault();
            const targetRow = e.target.closest(".item-transacao");
            if (!targetRow || !draggedId) return;

            const targetOnclick = targetRow.getAttribute("onclick");
            const targetId = targetOnclick.match(/'([^']+)'/)[1];

            if (draggedId === targetId) return;

            const mes = document.getElementById("filtroMes").value;
            const ano = getAnoSelecionado();
            const listaMes = dados[ano] && dados[ano][mes];
            if (!listaMes) return;

            // 1. Localiza os índices reais no array original
            const indexOrigem = listaMes.findIndex(i => i.id == draggedId);
            const indexDestino = listaMes.findIndex(i => i.id == targetId);

            if (indexOrigem !== -1 && indexDestino !== -1) {
                // 2. Reordena o array original baseado nos IDs
                const [itemMovido] = listaMes.splice(indexOrigem, 1);
                listaMes.splice(indexDestino, 0, itemMovido);

                // 3. Feedback visual e persistência
                render();
                
                persistDadosLocal(Date.now());
                
                if (typeof salvarDados === "function") {
                    await salvarDados();
                } else if (typeof salvarNoBanco === "function") {
                    await salvarNoBanco();
                }
            }
        });
    });
}

function toggleMetasFlutuante() {
    const modal = document.getElementById("modalMetas");
    
    if (!modal) {
        console.error("Erro: Elemento #modalMetas não encontrado no DOM.");
        return;
    }

    if (modal.style.display === "none" || modal.style.display === "") {
        renderizarMetasDetalhadas();
        modal.style.display = "flex";
        modal.setAttribute("aria-hidden", "false");
    } else {
        modal.style.display = "none";
        modal.setAttribute("aria-hidden", "true");
    }
}

function renderizarMetasDetalhadas() {
    const container = document.getElementById("conteudoMetas");
    if (!container) return;

    const mes = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    
    let pagIn = 0, adiIn = 0;
    let gastos = {
        Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
        Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
    };

    if (!dados[ano] || !dados[ano][mes]) return;

    dados[ano][mes].forEach(item => {
        const valor = parseFloat(item.valor) || 0;
        const categoria = item.cat ? item.cat.toLowerCase() : ""; 
        const origem = item.origem ? item.origem.toLowerCase() : ""; 

        // 1. ENTRADAS (Ajustado para "pag" e "adi")
        if (categoria.includes("entrada")) {
            const desc = item.desc ? item.desc.toLowerCase() : "";
            if (origem.includes("pag") || desc.includes("pag")) {
                pagIn += valor;
            } else if (origem.includes("adi") || desc.includes("adi")) {
                adiIn += valor;
            }
        } 
        
        // 2. GASTOS (Ajustado para identificar "Crédito-Pag" e "Crédito-Adi")
        else if (item.pago !== false) {
            let alvo = null;
            
            // Se a origem tiver "pag", vai para o bloco de Pagamento
            if (origem.includes("pag")) {
                alvo = gastos.Pagamento;
            } 
            // Se a origem tiver "adi", vai para o bloco de Adiantamento
            else if (origem.includes("adi")) {
                alvo = gastos.Adiantamento;
            }

            if (alvo) {
                // Identifica a categoria
                if (categoria.includes("pessoal")) {
                    alvo.Pessoal += valor;
                } else if (categoria.includes("necessidade")) {
                    alvo.Necessidades += valor;
                } else if (categoria.includes("guardar")) {
                    alvo.Guardar += valor;
                }
            }
        }
    });

    container.innerHTML = `
        ${renderizarBlocoMeta("Metas Pagamento", pagIn, gastos.Pagamento)}
        ${renderizarBlocoMeta("Metas Adiantamento", adiIn, gastos.Adiantamento)}
    `;
}

function initSortable() {
    const el = document.getElementById('tabela-corpo');
    if (!el) return;

    Sortable.create(el, {
        handle: '.handle', // Só arrasta se pegar no ícone ≡
        animation: 150,
        onEnd: function (evt) {
            const mesAtualNome = document.getElementById("filtroMes").value;
            const ano = getAnoSelecionado();
            const listaMes = dados[ano] && dados[ano][mesAtualNome];
            if (!listaMes) return;
            
            // Remove o item da posição antiga e coloca na nova
            const itemMovido = listaMes.splice(evt.oldIndex, 1)[0];
            listaMes.splice(evt.newIndex, 0, itemMovido);
            
            // Salva a nova ordem e atualiza a tela
            persistDadosLocal(Date.now());
            render(); 

            // NOVO: Sincroniza a nova ordem com o Supabase automaticamente
            if (typeof salvarNoBanco === "function") {
                salvarNoBanco();
            }
        }
    });
}

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
function buildMenuAnos() {
    const sel = document.getElementById("filtroAno");
    if (!sel || sel.dataset.built) return;
    const y = new Date().getFullYear();
    for (let a = y - 5; a <= y + 3; a++) {
        const opt = document.createElement("option");
        opt.value = String(a);
        opt.textContent = String(a);
        sel.appendChild(opt);
    }
    sel.value = String(y);
    sel.dataset.built = "1";
    sel.addEventListener("change", () => render());
}

window.addEventListener("load", () => {
    verificarAcesso();

    const filtroMes = document.getElementById("filtroMes");
    if (filtroMes) {
        buildMenuAnos();
        filtroMes.value = MESES_ANO[new Date().getMonth()];
        buildMenuMeses();
        carregarDadosDoBanco();
    }
});

function toggleMenuFixos() {
    const menu = document.getElementById("menuFixosOpcoes");
    const btn = document.getElementById("btnMasterFixos");
    if (!menu || !btn) return;

    if (!menu.classList.contains("aberto")) {
        menu.classList.add("aberto");
        btn.setAttribute("aria-expanded", "true");
        menu.setAttribute("aria-hidden", "false");
        btn.style.transform = "rotate(90deg)";
        btn.style.background = "var(--inter-orange)";
    } else {
        menu.classList.remove("aberto");
        btn.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-hidden", "true");
        btn.style.transform = "rotate(0deg)";
        btn.style.background = "";
    }
}

// Fechar o menu se clicar fora dele
window.addEventListener("click", function (e) {
    const menu = document.getElementById("menuFixosOpcoes");
    const btn = document.getElementById("btnMasterFixos");
    if (!menu || !btn) return;
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.classList.remove("aberto");
        btn.setAttribute("aria-expanded", "false");
        menu.setAttribute("aria-hidden", "true");
        btn.style.transform = "";
        btn.style.background = "";
    }
});

function abrirEdicao(id) {
    const mesAtual = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    if (!dados[ano] || !dados[ano][mesAtual]) return;
    const item = dados[ano][mesAtual].find(i => i.id == id);

    if (item) {
        document.getElementById("editId").value = item.id;
        document.getElementById("editDesc").value = item.desc;
        document.getElementById("editValor").value = item.valor;
        document.getElementById("editCat").value = item.cat;
        document.getElementById("editOrigem").value = item.origem || "Carteira";
        
        const btnPagar = document.getElementById("btnPagarAgora");
        if (btnPagar) btnPagar.style.display = item.pago === false ? "block" : "none";

        modalShow("modalEdicao", true);
        const ev = document.getElementById("editDesc");
        setTimeout(() => ev && ev.focus(), 0);
    }
}

///EXTRATO

function fecharModalEdicao() {
    modalShow("modalEdicao", false);
}

// Função centralizadora de salvamento (Resolve o erro de "not defined")
async function salvarDados() {
    persistDadosLocal(Date.now());
    if (typeof salvarNoBanco === "function") {
        await salvarNoBanco();
    }
}

async function salvarEdicao() {
    const mesAtual = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    const id = document.getElementById("editId").value;
    
    if (!dados[ano] || !dados[ano][mesAtual]) return;
    const index = dados[ano][mesAtual].findIndex(i => i.id == id);
    
    if (index !== -1) {
        // Atualiza os dados no objeto local
        dados[ano][mesAtual][index].desc = document.getElementById("editDesc").value;
        dados[ano][mesAtual][index].valor = parseFloat(document.getElementById("editValor").value);
        dados[ano][mesAtual][index].cat = document.getElementById("editCat").value;
        dados[ano][mesAtual][index].origem = document.getElementById("editOrigem").value;
        
        fecharModalEdicao();
        
        // Chama a persistência
        await salvarDados(); 
        render(); 
    }
}

// 1. Acionado pelo botão de lixeira no modal de Edição
function removerItemEdicao() {
    // Em vez de confirm(), apenas abrimos o modal de confirmação interno
    const id = document.getElementById("editId").value;
    indexParaRemover = id; // Usamos o ID como referência
    
    // Esconde o modal de edição para não sobrepor
    fecharModalEdicao();
    
    // Abre o modal de confirmação do próprio site
    const modalConfirm = document.getElementById("modalConfirmarExclusao");
    if(modalConfirm) {
        modalShow("modalConfirmarExclusao", true);
        document.getElementById("btnConfirmarDeletar").onclick = executarRemocao;
    }
}

async function executarRemocao() {
    const mesAtual = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    const idParaRemover = indexParaRemover;

    if (!dados[ano] || !dados[ano][mesAtual]) return;
    // Filtra o array removendo o item com aquele ID
    dados[ano][mesAtual] = dados[ano][mesAtual].filter(item => item.id != idParaRemover);
    
    // Fecha o modal de confirmação
    fecharConfirmacao();
    
    // Salva e atualiza a tela
    await salvarDados(); 
    render();
    
    mostrarToastSucesso("Lançamento removido!");
}

async function confirmarPagamentoDireto(event, id) {
    event.stopPropagation();
    const mes = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    if (!dados[ano] || !dados[ano][mes]) return;
    const item = dados[ano][mes].find(i => i.id == id);
    if (item) {
        item.pago = true;
        persistDadosLocal(Date.now());
        render();
        await salvarDados();
        mostrarToastSucesso("Pagamento confirmado.");
    }
}


let startY = 0;
const pullThreshold = 100;
const pullIndicator = document.getElementById("pull-to-refresh");
const pullText = document.getElementById("pullText");
const spinner = document.getElementById("spinnerIcon");

if (pullIndicator && pullText && spinner) {
    window.addEventListener("touchstart", (e) => {
        if (window.scrollY === 0) {
            startY = e.touches[0].pageY;
        }
    }, { passive: true });

    window.addEventListener("touchmove", (e) => {
        const currentY = e.touches[0].pageY;
        const pullDistance = currentY - startY;

        if (window.scrollY === 0 && pullDistance > 0) {
            pullIndicator.style.display = "flex";
            pullIndicator.style.height = `${Math.min(pullDistance * 0.5, pullThreshold)}px`;
            const opacity = Math.min(pullDistance / pullThreshold, 1);
            pullIndicator.style.opacity = opacity;

            if (pullDistance > pullThreshold * 2) {
                pullText.innerText = "✨ Solte para atualizar";
                spinner.style.display = "block";
            } else {
                pullText.innerText = "⬇️ Puxe para atualizar";
                spinner.style.display = "none";
            }
        }
    }, { passive: true });

    window.addEventListener("touchend", async () => {
        const height = parseInt(pullIndicator.style.height, 10) || 0;

        if (height >= pullThreshold / 2) {
            pullText.innerText = "Atualizando...";
            spinner.classList.add("spinning");

            let ok = true;
            if (typeof carregarDadosDoBanco === "function") {
                ok = await carregarDadosDoBanco();
            } else {
                render();
            }

            setTimeout(() => {
                pullIndicator.style.height = "0px";
                pullIndicator.style.opacity = "0";
                spinner.classList.remove("spinning");
                if (ok) mostrarToastSucesso("Lista atualizada.");
            }, 400);
        } else {
            pullIndicator.style.height = "0px";
            pullIndicator.style.opacity = "0";
        }
        startY = 0;
    });
}

function isOverlayOpen(id) {
    const el = document.getElementById(id);
    return el && el.style.display === "flex";
}

document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (isOverlayOpen("modalLancamento")) {
        fecharModal();
        e.preventDefault();
        return;
    }
    if (isOverlayOpen("modalConfirmarFixos")) {
        fecharModalConfirmarFixos();
        e.preventDefault();
        return;
    }
    if (isOverlayOpen("modalConfirmarExclusao")) {
        fecharConfirmacao();
        e.preventDefault();
        return;
    }
    if (isOverlayOpen("modalConfigFixos")) {
        fecharModalFixos();
        e.preventDefault();
        return;
    }
    if (isOverlayOpen("modalEdicao")) {
        fecharModalEdicao();
        e.preventDefault();
        return;
    }
    const metas = document.getElementById("modalMetas");
    if (metas && metas.style.display === "flex") {
        toggleMetasFlutuante();
        e.preventDefault();
    }
});

applyStoredTheme();
