// ==========================================================================
// CONFIGURAÇÕES GERAIS E BANCO DE DADOS (SUPABASE)
// ==========================================================================
const SUPABASE_URL = "https://amqbggvxcyutlzubadio.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcWJnZ3Z4Y3l1dGx6dWJhZGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzc1NDksImV4cCI6MjA5MDIxMzU0OX0.PtlDWAmK7wCmFAs4QZIv3CSnlbqS11v8DCXw6K7NTvg"; 
const NOME_USUARIO = "mateusfsr";

let dados = JSON.parse(localStorage.getItem("dados")) || {
    "Janeiro": [], "Fevereiro": [], "Março": [], "Abril": [], "Maio": [], "Junho": [],
    "Julho": [], "Agosto": [], "Setembro": [], "Outubro": [], "Novembro": [], "Dezembro": []
};

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
// MONITOR DE INATIVIDADE (1 MINUTO)
// ==========================================================================
let idleTimer;

function resetIdleTimer() {
    clearTimeout(idleTimer);
    
    // Só ativa o timer se o usuário estiver logado e fora da tela de login
    if (localStorage.getItem("logado") === "true" && !window.location.pathname.endsWith("index.html")) {
        idleTimer = setTimeout(() => {
            console.log("Inatividade detectada...");
            logout();
        }, 300000); // 60 segundos
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
            dados = resultado[0].dados_json;
            localStorage.setItem("dados", JSON.stringify(dados));
            console.log("✅ Dados recuperados com sucesso.");
        }
    } catch (error) {
        console.error("❌ Falha ao carregar dados:", error);
    }
    render();
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
        const payload = { usuario: NOME_USUARIO, dados_json: dados };
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
                body: JSON.stringify({ dados_json: dados })
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
            // REMOVIDO: alert("✨ Sincronização concluída!");
            
            // NOVO: Chama o Toast com o checkmark animado
            mostrarToastSucesso("Sincronizado com a nuvem!");
            
            localStorage.setItem("dados", JSON.stringify(dados));
        } else {
            throw new Error("Erro no servidor");
        }

    } catch (error) {
        console.error(error);
        // Opcional: Você pode criar um mostrarToastErro() seguindo a mesma lógica
        alert("❌ Erro ao salvar na nuvem. Verifique sua conexão.");
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
    document.getElementById("modalConfigFixos").style.display = "flex";
    renderizarListaModelos();
}

function fecharModalFixos() {
    document.getElementById("modalConfigFixos").style.display = "none";
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

async function lancarContasFixas() {
    const mes = document.getElementById("filtroMes").value;
    
    if (modelosFixos.length === 0) {
        alert("Nenhum modelo cadastrado!"); // Aqui pode manter alert ou usar um Toast de erro
        return;
    }

    // REMOVIDO: if (confirm(...))
    // NOVA LÓGICA: Executa direto ou você pode abrir um modal de "Processando"
    
    modelosFixos.forEach(c => {
        dados[mes].push({
            id: Date.now() + Math.random(),
            desc: `[PREVISTO] ${c.desc}`,
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
    if(menu) menu.classList.remove("aberto");
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
    const seletores = "#vTotal, #vPag, #vAdi, .valor-tabela, .input-valor";
    const elementos = document.querySelectorAll(seletores);

    elementos.forEach(el => {
        if (modoFurtivo) {
            el.classList.add("blur-efect");
        } else {
            el.classList.remove("blur-efect");
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
        alert("Preencha a descrição e o valor!");
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

    if (!dados[mes]) dados[mes] = [];
    dados[mes].push(novoItem);
    
    // Limpeza
    desc.value = "";
    valor.value = "";
    if (check) check.checked = false; 
    
    localStorage.setItem("dados", JSON.stringify(dados));
    render();
}

let indexParaRemover = null; // Variável global temporária

// 1. A função que o botão ✕ da tabela chama
function remover(index) {
    indexParaRemover = index; // Guarda qual item o usuário quer apagar
    const modal = document.getElementById("modalConfirmarExclusao");
    modal.style.display = "flex";
    
    // Configura o clique do botão de confirmação dentro do modal
    document.getElementById("btnConfirmarDeletar").onclick = executarRemocao;
}

// 2. A função que realmente apaga o dado
function executarRemocao() {
    if (indexParaRemover !== null) {
        const mesAtual = document.getElementById("filtroMes").value;
        
        dados[mesAtual].splice(indexParaRemover, 1);
        
        localStorage.setItem("dados", JSON.stringify(dados));
        fecharConfirmacao();
        render();
        
        mostrarToastSucesso("Lançamento removido!");
        salvarNoBanco(); // <--- ADICIONADO: Salva no Supabase após remover
    }
}

function fecharConfirmacao() {
    document.getElementById("modalConfirmarExclusao").style.display = "none";
    indexParaRemover = null;
}

let timeoutAutoSave;

function editarCampo(index, campo, novoValor) {
    const mes = document.getElementById("filtroMes").value;
    if (campo === "valor") {
        dados[mes][index][campo] = parseFloat(novoValor) || 0;
    } else {
        dados[mes][index][campo] = novoValor;
    }
    localStorage.setItem("dados", JSON.stringify(dados));
    
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
    const mesesAno = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    
    if (!document.getElementById("filtroMes").value) {
        document.getElementById("filtroMes").value = mesesAno[new Date().getMonth()];
    }

    const mesAtualNome = document.getElementById("filtroMes").value;
    const indexMesAtual = mesesAno.indexOf(mesAtualNome);
    const lista = document.getElementById("lista");
    const resumo = document.getElementById("resumo");

    if (!dados[mesAtualNome]) dados[mesAtualNome] = [];

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
    dados[mesAtualNome].forEach(item => {
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
        const nomeM = mesesAno[i];
        if (dados[nomeM]) {
            dados[nomeM].forEach(item => { 
                if (item.cat === "Guardar" && item.pago !== false) totalCaixinhaHistorico += item.valor; 
            });
        }
    }

    const limiteDisponivel = totalCaixinhaHistorico - limiteUsadoNoMes;
    const porcentagemGastoLimite = totalCaixinhaHistorico > 0 ? (limiteUsadoNoMes / totalCaixinhaHistorico) * 100 : 0;
    const estiloBrilho = porcentagemGastoLimite >= 90 ? `box-shadow: 0 0 15px #ff4d4d; animation: pulseGlow 1.5s infinite alternate;` : '';
    
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
                    <span class="bank-label">LIMITE DISPONÍVEL (CAIXINHA)</span>
                    
                    <strong class="bank-value limite-valor">
                        R$ ${limiteDisponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </strong>

                    <div class="barra-limite">
                        <div class="barra-preenchimento" style="width: ${Math.min(porcentagemGastoLimite, 100)}%"></div>
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

    // 3. EXTRATO AGRUPADO
    const agrupadoPorData = {};
    dados[mesAtualNome].forEach(item => {
        const dataKey = item.dataCriacao ? item.dataCriacao.split('T')[0] : new Date().toISOString().split('T')[0];
        if (!agrupadoPorData[dataKey]) agrupadoPorData[dataKey] = [];
        agrupadoPorData[dataKey].push(item);
    });

    const datasOrdenadas = Object.keys(agrupadoPorData).sort((a, b) => new Date(b) - new Date(a));

    let htmlExtrato = `
        <div class="bank-card" style="margin-top:20px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                <h3 style="font-size: 16px; font-weight: 600; color: ${corDinamica}">Extrato</h3>
                <span style="color:${corSuave}; font-size:12px">${dados[mesAtualNome].length} lançamentos</span>
            </div>
            <div class="container-extrato">`;

    datasOrdenadas.forEach(data => {
        const transacoesDoDia = agrupadoPorData[data];
        const dataObj = new Date(data + "T12:00:00");
        const hoje = new Date().toISOString().split('T')[0];
        let dataTexto = data === hoje ? "Hoje" : dataObj.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' });

        htmlExtrato += `
            <div class="grupo-data">
                <div class="cabecalho-data" style="border-bottom: 1px solid var(--inter-border); padding-bottom: 8px; margin-bottom: 10px; margin-top: 15px;">
                    <span style="font-size: 14px; font-weight: bold; color: ${corDinamica}">${dataTexto}</span>
                </div>
        `;

        transacoesDoDia.forEach(item => {
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
                    <div style="font-size: 14px; font-weight: bold; color: ${isEntrada ? 'var(--green)' : corDinamica}">
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
        htmlExtrato += `</div>`;
    });

    htmlExtrato += `</div></div>`;
    lista.innerHTML = htmlExtrato;

    document.querySelectorAll(".mes-btn").forEach(btn => btn.classList.toggle("ativo", btn.innerText.trim() === mesAtualNome));
    animarValoresTela(
    totalEntradas - totalSaidas,
    saldoPagamento,
    saldoAdiantamento
    );
    aplicarModoFurtivo();
    ativarDragAndDrop();
}

// FUNÇÃO COMPLEMENTAR PARA O BOTÃO "PAGAR"
function confirmarPagamento(id) {
    const mes = document.getElementById("filtroMes").value;
    const item = dados[mes].find(i => i.id == id || i.id === parseFloat(id));
    if (item) {
        item.pago = true;
        item.desc = item.desc.replace("[PREVISTO] ", "");
        render();
        if(typeof salvarNoBanco === "function") salvarNoBanco();
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
    const formatar = (v) => "R$ " + v.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    document.getElementById("vTotal").innerText = formatar(total);
    document.getElementById("vPag").innerText = formatar(pag);
    document.getElementById("vAdi").innerText = formatar(adi);
}

function mudarMes(novoMes) {
    document.getElementById("filtroMes").value = novoMes;
    render();
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", isDark);
}

// ==========================================================================
// MODAIS E DASHBOARD
// ==========================================================================

function abrirModal() { document.getElementById("modalLancamento").style.display = "flex"; }

function fecharModal() { document.getElementById("modalLancamento").style.display = "none"; }

function mostrarToastSucesso() {
    const toast = document.getElementById("toast-sucesso");
    toast.style.display = "flex";
    toast.style.animation = "slideInRight 0.5s ease forwards";

    // Esconde automaticamente após 3 segundos
    setTimeout(() => {
        toast.style.animation = "slideOutRight 0.5s ease forwards";
        setTimeout(() => { toast.style.display = "none"; }, 500);
    }, 3000);
}

function adicionarComModal() {
    const desc = document.getElementById("desc");
    const valor = document.getElementById("valor");
    const cat = document.getElementById("cat"); 
    const origem = document.getElementById("origem"); 
    const mes = document.getElementById("filtroMes").value;
    const check = document.getElementById("checkPrevisto"); 

    if (!desc.value || !valor.value) {
        alert("Preencha a descrição e o valor!");
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

    if (!dados[mes]) dados[mes] = [];
    dados[mes].push(novoItem);
    
    // Limpar e fechar
    desc.value = "";
    valor.value = "";
    if (check) check.checked = false; 
    
    fecharModal(); // Fecha o modal após adicionar
    
    localStorage.setItem("dados", JSON.stringify(dados));
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
    const dMes = dados[mes] || [];
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
    for (let m in dados) {
        dados[m].forEach(item => {
            rows.push({ "Mês": m, "Descrição": item.desc, "Valor": item.valor, "Categoria": item.cat, "Origem": item.origem });
        });
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
            if (!novosDados[m]) novosDados[m] = [];
            novosDados[m].push({ desc: row["Descrição"], valor: parseFloat(row["Valor"]), cat: row["Categoria"], origem: row["Origem"] });
        });
        dados = novosDados;
        render();
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
            const listaMes = dados[mes];

            // 1. Localiza os índices reais no array original
            const indexOrigem = listaMes.findIndex(i => i.id == draggedId);
            const indexDestino = listaMes.findIndex(i => i.id == targetId);

            if (indexOrigem !== -1 && indexDestino !== -1) {
                // 2. Reordena o array original baseado nos IDs
                const [itemMovido] = listaMes.splice(indexOrigem, 1);
                listaMes.splice(indexDestino, 0, itemMovido);

                // 3. Feedback visual e persistência
                render();
                
                if (typeof salvarNoLocalStorage === "function") {
                    localStorage.setItem("dados", JSON.stringify(dados));
                }
                
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
        renderizarMetasDetalhadas(); // Chama a função que calcula as barras
        modal.style.display = "flex";
    } else {
        modal.style.display = "none";
    }
}

function renderizarMetasDetalhadas() {
    const container = document.getElementById("conteudoMetas");
    if (!container) return;

    const mes = document.getElementById("filtroMes").value;
    
    let pagIn = 0, adiIn = 0;
    let gastos = {
        Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
        Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
    };

    if (!dados[mes]) return;

    dados[mes].forEach(item => {
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
            const listaMes = dados[mesAtualNome];
            
            // Remove o item da posição antiga e coloca na nova
            const itemMovido = listaMes.splice(evt.oldIndex, 1)[0];
            listaMes.splice(evt.newIndex, 0, itemMovido);
            
            // Salva a nova ordem e atualiza a tela
            localStorage.setItem("dados", JSON.stringify(dados));
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
window.addEventListener("load", () => {
    verificarAcesso();
    if (localStorage.getItem("darkMode") === "true") document.body.classList.add("dark-mode");
    
    // Define o mês atual na inicialização
    const mesesAno = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    document.getElementById("filtroMes").value = mesesAno[new Date().getMonth()];
    
    carregarDadosDoBanco();
});

function toggleMenuFixos() {
    const menu = document.getElementById("menuFixosOpcoes");
    const btn = document.getElementById("btnMasterFixos");
    
    if (!menu.classList.contains("aberto")) {
        menu.classList.add("aberto");
        btn.style.transform = "rotate(90deg)";
        btn.style.background = "var(--inter-orange)";
    } else {
        menu.classList.remove("aberto");
        btn.style.transform = "rotate(0deg)";
        btn.style.background = "";
    }
}

// Fechar o menu se clicar fora dele
window.addEventListener('click', function(e) {
    const menu = document.getElementById("menuFixosOpcoes");
    const btn = document.getElementById("btnMasterFixos");
    if (!btn.contains(e.target) && !menu.contains(e.target)) {
        menu.style.display = "none";
        btn.classList.remove("active-gear");
    }
});

function abrirEdicao(id) {
    const mesAtual = document.getElementById("filtroMes").value;
    const item = dados[mesAtual].find(i => i.id == id);

    if (item) {
        document.getElementById("editId").value = item.id;
        document.getElementById("editDesc").value = item.desc;
        document.getElementById("editValor").value = item.valor;
        document.getElementById("editCat").value = item.cat;
        document.getElementById("editOrigem").value = item.origem || "Carteira";
        
        // MOSTRAR OU ESCONDER BOTÃO DE PAGAR
        const btnPagar = document.getElementById("btnPagarAgora");
        if (item.pago === false) {
            btnPagar.style.display = "block";
        } else {
            btnPagar.style.display = "none";
        }

        document.getElementById("modalEdicao").style.display = "flex";
    }
}

///EXTRATO

// Função para abrir o modal de edição preenchido
function abrirEdicao(id) {
    const mesAtual = document.getElementById("filtroMes").value;
    const item = dados[mesAtual].find(i => i.id == id);

    if (item) {
        document.getElementById("editId").value = item.id;
        document.getElementById("editDesc").value = item.desc;
        document.getElementById("editValor").value = item.valor;
        document.getElementById("editCat").value = item.cat;
        document.getElementById("editOrigem").value = item.origem || "Carteira";
        
        document.getElementById("modalEdicao").style.display = "flex";
    }
}

function fecharModalEdicao() {
    document.getElementById("modalEdicao").style.display = "none";
}

// Função centralizadora de salvamento (Resolve o erro de "not defined")
async function salvarDados() {
    // 1. Atualiza o banco local
    localStorage.setItem("dados", JSON.stringify(dados));
    
    // 2. Chama sua função existente que sincroniza com o Supabase
    if (typeof salvarNoBanco === "function") {
        await salvarNoBanco();
    }
}

async function salvarEdicao() {
    const mesAtual = document.getElementById("filtroMes").value;
    const id = document.getElementById("editId").value;
    
    const index = dados[mesAtual].findIndex(i => i.id == id);
    
    if (index !== -1) {
        // Atualiza os dados no objeto local
        dados[mesAtual][index].desc = document.getElementById("editDesc").value;
        dados[mesAtual][index].valor = parseFloat(document.getElementById("editValor").value);
        dados[mesAtual][index].cat = document.getElementById("editCat").value;
        dados[mesAtual][index].origem = document.getElementById("editOrigem").value;
        
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
        modalConfirm.style.display = "flex";
        // Configuramos o botão de "Sim" para chamar a execução final
        document.getElementById("btnConfirmarDeletar").onclick = executarRemocao;
    }
}

async function executarRemocao() {
    const mesAtual = document.getElementById("filtroMes").value;
    const idParaRemover = indexParaRemover;

    // Filtra o array removendo o item com aquele ID
    dados[mesAtual] = dados[mesAtual].filter(item => item.id != idParaRemover);
    
    // Fecha o modal de confirmação
    fecharConfirmacao();
    
    // Salva e atualiza a tela
    await salvarDados(); 
    render();
    
    mostrarToastSucesso("Lançamento removido!");
}

function confirmarPagamentoDireto(event, id) {
    event.stopPropagation(); // Não abre o modal de edição
    const mes = document.getElementById("filtroMes").value;
    
    const item = dados[mes].find(i => i.id == id);
    if (item) {
        item.pago = true;
        localStorage.setItem("dados", JSON.stringify(dados));
        render();
        if (typeof mostrarToast === "function") mostrarToast();
    }
}
