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
    if (!raw || typeof raw !== "object") return { data: null, updatedAt: 0, modelosFixos: undefined };
    // Envelope guardado no Supabase: { data, updatedAt?, modelosFixos? }
    // Se `updatedAt` faltar (ex.: só a Edge Function do Telegram gravou), ainda precisamos usar `data`.
    if (raw.data !== undefined && raw.data !== null && typeof raw.data === "object") {
        return {
            data: raw.data,
            updatedAt: raw.updatedAt != null ? Number(raw.updatedAt) || 0 : 0,
            modelosFixos: Array.isArray(raw.modelosFixos) ? raw.modelosFixos : undefined,
        };
    }
    return { data: raw, updatedAt: 0, modelosFixos: undefined };
}

const DEFAULT_MODELOS_FIXOS = [
    { desc: "Internet", valor: 100.0, cat: "Necessidades", origem: "Pagamento" },
    { desc: "Copel", valor: 180.0, cat: "Necessidades", origem: "Pagamento" },
];

function normalizarModelosFixos(arr) {
    if (!Array.isArray(arr)) return [];
    return arr
        .map((m) => ({
            desc: m && m.desc != null ? String(m.desc).trim() : "",
            valor: m ? parseFloat(m.valor) : 0,
            cat: (m && m.cat) || "Necessidades",
            origem: (m && m.origem) || "Pagamento",
        }))
        .filter((m) => m.desc.length > 0 && !Number.isNaN(m.valor));
}

function limparPersistenciaLocalDados() {
    // "Dados" do usuário não devem competir com a nuvem.
    try {
        localStorage.removeItem("dados");
        localStorage.removeItem("dadosUpdatedAt");
    } catch {
        // Ignora: alguns navegadores podem bloquear storage.
    }
}

function persistDadosLocal() {
    // Nao persiste dados no navegador; a fonte de verdade e a nuvem.
}

function loadDadosInicialLocal() {
    limparPersistenciaLocalDados();
    // Inicia vazio; o carregamento real vem do Supabase.
    return migrarEstruturaLegada(null);
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

let sortableExtrato = null;
let sortableModelosFixos = null;
let syncStatusHideTimer = null;
let ultimoRemovido = null;
let desfazerToastTimer = null;

function setSyncStatus(mode) {
    const el = document.getElementById("sync-status");
    if (!el) return;
    clearTimeout(syncStatusHideTimer);
    el.className = "sync-status sync-status--" + mode;
    const labels = {
        idle: "",
        loading: "Sincronizando…",
        saved: "Salvo na nuvem",
        error: "Falha ao sincronizar",
    };
    el.textContent = labels[mode] ?? "";
    if (mode === "saved") {
        syncStatusHideTimer = setTimeout(() => {
            el.textContent = "";
            el.className = "sync-status sync-status--idle";
        }, 2800);
    }
}

function calcularResumoMes(anoStr, mesNome) {
    if (!dados[anoStr] || !dados[anoStr][mesNome]) {
        return { totalEntradas: 0, totalSaidas: 0, liquido: 0 };
    }
    const normalizar = (txt) =>
        (txt || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    let totalEntradas = 0;
    let totalSaidas = 0;
    dados[anoStr][mesNome].forEach((item) => {
        const valor = parseFloat(item.valor) || 0;
        const categoria = normalizar(item.cat);
        const origem = normalizar(item.origem);
        const desc = normalizar(item.desc);
        const isCreditoPag =
            origem.includes("credito-pag") ||
            categoria.includes("credito-pag") ||
            desc.includes("credito-pag");
        const isCredito = origem.includes("credito") || categoria.includes("credito");
        const isAjuste = categoria.includes("ajuste") || origem.includes("ajuste") || desc.includes("ajuste");
        const isAjusteCredito = isCredito && isAjuste;
        if (isCreditoPag) {
            return;
        }
        if (item.cat === "Entrada") {
            totalEntradas += valor;
        } else if (item.pago !== false && !isAjusteCredito) {
            totalSaidas += valor;
        }
    });
    return {
        totalEntradas,
        totalSaidas,
        liquido: totalEntradas - totalSaidas,
    };
}

function mesAnteriorRef(anoStr, mesNome) {
    const idx = MESES_ANO.indexOf(mesNome);
    if (idx <= 0) {
        return { ano: String(Number(anoStr) - 1), mes: MESES_ANO[11] };
    }
    return { ano: anoStr, mes: MESES_ANO[idx - 1] };
}

function formatarDataExtrato(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

// ==========================================================================
// COMUNICAÇÃO COM SUPABASE (PERSISTÊNCIA REMOTA)
// ==========================================================================
async function carregarDadosDoBanco() {
    console.log("🔄 Sincronizando com Supabase...");
    setSyncStatus("loading");
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
            const { data: rawData, modelosFixos: modelosNuvem } = parsePayloadNuvem(resultado[0].dados_json);
            const remoteData = migrarEstruturaLegada(rawData);
            dados = remoteData;
            if (Array.isArray(modelosNuvem)) {
                modelosFixos = normalizarModelosFixos(modelosNuvem);
                try {
                    localStorage.setItem("tws_modelos_fixos", JSON.stringify(modelosFixos));
                } catch {
                    // ignora
                }
                if (document.getElementById("listaModelosFixos")) {
                    renderizarListaModelos();
                }
            }
            console.log("✅ Dados da nuvem aplicados.");
        }
        render();
        setSyncStatus("saved");
        return true;
    } catch (error) {
        console.error("❌ Falha ao carregar dados:", error);
        setSyncStatus("error");
        mostrarToastErro("Não foi possível atualizar da nuvem. Mostrando dados em memória.");
        render();
        return false;
    }
}

async function salvarNoBanco() {
    const btn = document.getElementById("btnSalvar");

    if (btn) {
        btn.innerHTML = "<span>⏳</span><br><small>Salvando</small>";
        btn.disabled = true;
    }

    setSyncStatus("loading");

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
        const envelope = { data: dados, updatedAt, modelosFixos };
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

        if (finalRes.ok) {
            setSyncStatus("saved");
        } else {
            throw new Error("Erro no servidor");
        }
    } catch (error) {
        console.error(error);
        setSyncStatus("error");
        mostrarToastErro("Erro ao salvar na nuvem. Verifique sua conexão.");
    } finally {
        if (btn) {
            btn.innerHTML = "<span>☁️</span><br><small>Salvar</small>";
            btn.disabled = false;
        }
    }
}

// Modelos de fixos: espelho local + fonte na nuvem (dados_json.modelosFixos)
let modelosFixos;
try {
    const rawM = localStorage.getItem("tws_modelos_fixos");
    modelosFixos = rawM ? JSON.parse(rawM) : null;
} catch {
    modelosFixos = null;
}
if (!Array.isArray(modelosFixos)) {
    modelosFixos = DEFAULT_MODELOS_FIXOS.map((m) => ({ ...m }));
}
modelosFixos = normalizarModelosFixos(modelosFixos);

// Abre o gerenciador
function abrirGerenciadorFixos() {
    modalShow("modalConfigFixos", true);
    renderizarListaModelos();
}

function fecharModalFixos() {
    if (sortableModelosFixos) {
        sortableModelosFixos.destroy();
        sortableModelosFixos = null;
    }
    modalShow("modalConfigFixos", false);
}

function escapeHtmlModelo(str) {
    if (str == null) return "";
    return String(str)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function persistModelosFixosOrdem() {
    try {
        localStorage.setItem("tws_modelos_fixos", JSON.stringify(modelosFixos));
    } catch {
        // ignora
    }
    if (typeof salvarNoBanco === "function") {
        salvarNoBanco();
    }
}

function initSortableModelosFixos() {
    const el = document.getElementById("listaModelosFixos");
    if (!el || typeof Sortable === "undefined" || modelosFixos.length < 2) return;

    if (sortableModelosFixos) {
        sortableModelosFixos.destroy();
        sortableModelosFixos = null;
    }

    sortableModelosFixos = Sortable.create(el, {
        animation: 150,
        handle: ".modelo-fixo-handle",
        draggable: ".modelo-fixo-item",
        filter: "button",
        preventOnFilter: true,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        scroll: true,
        forceAutoScrollFallback: true,
        bubbleScroll: true,
        scrollSensitivity: 48,
        scrollSpeed: 14,
        onEnd(evt) {
            if (evt.oldIndex === evt.newIndex) return;
            const [movido] = modelosFixos.splice(evt.oldIndex, 1);
            modelosFixos.splice(evt.newIndex, 0, movido);
            persistModelosFixosOrdem();
            queueMicrotask(() => renderizarListaModelos());
        },
    });
}

// Renderiza a lista dentro do modal (mesmo layout em todas as telas; ordem arrastável)
function renderizarListaModelos() {
    const container = document.getElementById("listaModelosFixos");
    if (!container) return;

    if (sortableModelosFixos) {
        sortableModelosFixos.destroy();
        sortableModelosFixos = null;
    }

    if (modelosFixos.length === 0) {
        container.innerHTML =
            '<p class="lista-modelos-fixos__empty" role="status">Nenhum modelo cadastrado. Adicione abaixo.</p>';
        return;
    }

    container.innerHTML = modelosFixos
        .map(
            (m, index) => `
        <div class="modelo-fixo-item" data-index="${index}">
            <div class="modelo-fixo-handle" aria-label="Arrastar para reordenar" title="Arrastar">⋮⋮</div>
            <div class="modelo-fixo-body">
                <span class="modelo-fixo-desc">${escapeHtmlModelo(m.desc)}</span>
                <span class="modelo-fixo-valor">R$ ${Number(m.valor).toFixed(2)}</span>
                <span class="modelo-fixo-meta">${escapeHtmlModelo(m.cat || "Necessidades")} · ${escapeHtmlModelo(m.origem || "Pagamento")}</span>
            </div>
            <button type="button" onclick="removerModeloFixo(${index})" class="modelo-fixo-remove btn-clear" aria-label="Remover modelo">✕</button>
        </div>
    `
        )
        .join("");

    queueMicrotask(() => initSortableModelosFixos());
}

function adicionarNovoModeloFixo() {
    const desc = document.getElementById("fixoDesc").value;
    const valor = parseFloat(document.getElementById("fixoValor").value);
    const cat = document.getElementById("fixoCat")?.value || "Necessidades";
    const origem = document.getElementById("fixoOrigem")?.value || "Pagamento";

    if (desc && valor) {
        modelosFixos.push({ desc, valor, cat, origem });
        persistModelosFixosOrdem();
        document.getElementById("fixoDesc").value = "";
        document.getElementById("fixoValor").value = "";
        renderizarListaModelos();
    }
}

function removerModeloFixo(index) {
    modelosFixos.splice(index, 1);
    persistModelosFixosOrdem();
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
    const listaMes = ensureAnoMes(ano, mes);
    modelosFixos
        .slice()
        .reverse()
        .forEach((c) => {
            listaMes.unshift({
                id: Date.now() + Math.random(),
                desc: c.desc,
                valor: c.valor,
                cat: c.cat || "Necessidades",
                origem: c.origem || "Pagamento",
                pago: false,
                dataCriacao: new Date().toISOString(),
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
    if (btnOlho) btnOlho.classList.toggle("is-blurring", modoFurtivo);

    // Seleciona todos os elementos que devem ser borrados
    // IDs dos saldos + classes de valores na tabela
    const seletores = "#vTotal, #vPag, #vAdi, .limite-valor, .valor-tabela, .input-valor, .comparacao-valor";
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
    ensureAnoMes(ano, mes).unshift(novoItem);

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
    const origem = (item.origem || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const desc = (item.desc || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const categoria = (item.cat || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    const isCreditoPag = origem.includes("credito-pag") || categoria.includes("credito-pag") || desc.includes("credito-pag");
    const isCredito = origem.includes("credito") || categoria.includes("credito");

    // =====================
    // ENTRADAS
    // =====================
    if (isCreditoPag) {
        // "credito-pag" é movimentação interna do cartão: não altera o saldo total.
        limiteUsadoNoMes -= valor;
    } else if (item.cat === "Entrada") {
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
        const isAjuste = categoria.includes("ajuste") || origem.includes("ajuste") || desc.includes("ajuste");
        const isAjusteCredito = isCredito && isAjuste;

        // Ajuste de credito deve afetar somente o limite, sem baixar saldo em conta.
        if (!isAjusteCredito) {
            totalSaidas += valor;

            if (origem.includes("pag")) {
                pagOut += valor;
            }

            if (origem.includes("adi")) {
                adiOut += valor;
            }
        }

        if (isCredito) {
            limiteUsadoNoMes += valor;
        }
    }
    });
    limiteUsadoNoMes = Math.max(0, limiteUsadoNoMes);

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

    const refAnt = mesAnteriorRef(ano, mesAtualNome);
    const resumoAtual = calcularResumoMes(ano, mesAtualNome);
    const resumoAnt = calcularResumoMes(refAnt.ano, refAnt.mes);
    const deltaLiquido = resumoAtual.liquido - resumoAnt.liquido;
    const baseAnt = Math.abs(resumoAnt.liquido);
    const pctVsAnt = baseAnt >= 0.01 ? (deltaLiquido / baseAnt) * 100 : null;
    let deltaClass = "resumo-comparacao__delta--flat";
    if (deltaLiquido > 0.005) deltaClass = "resumo-comparacao__delta--up";
    else if (deltaLiquido < -0.005) deltaClass = "resumo-comparacao__delta--down";
    
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
                    
                    <strong class="bank-value destaque tabular-nums" id="vTotal">
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
                    
                    <strong class="bank-value limite-valor tabular-nums">
                        R$ ${limiteDisponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </strong>

                    <div class="resumo-limite-detalhes tabular-nums">
                        <span>Total R$ ${totalCaixinhaHistorico.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                        <span class="resumo-limite-sep">·</span>
                        <span>Utilizado R$ ${limiteUsadoNoMes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</span>
                    </div>

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
                <strong id="vPag" class="tabular-nums">R$ 0,00</strong>
            </div>

            <div class="divisor-vertical"></div>

            <div class="resumo-item direita">
                <span class="bank-label">SALDO ADIANTAMENTO</span>
                <strong id="vAdi" class="tabular-nums">R$ 0,00</strong>
            </div>

        </div>

        <div class="bank-card resumo-comparacao full">
            <div class="resumo-comparacao__head">
                <span class="resumo-comparacao__head-title">Comparativo</span>
                <span class="resumo-comparacao__head-sub">Mês anterior · ${refAnt.mes}</span>
            </div>
            <div class="resumo-comparacao__row">
                <div class="resumo-comparacao__col">
                    <span class="resumo-comparacao__metric-label">Este mês</span>
                    <div class="comparacao-valor tabular-nums" style="color: ${corDinamica}">R$ ${resumoAtual.liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
                <div class="resumo-comparacao__divider" aria-hidden="true"></div>
                <div class="resumo-comparacao__col">
                    <span class="resumo-comparacao__metric-label">Mês anterior</span>
                    <div class="comparacao-valor tabular-nums comparacao-valor--muted" style="color: ${corSuave}">R$ ${resumoAnt.liquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div>
                </div>
            </div>
            <div class="resumo-comparacao__delta ${deltaClass}">
                <span class="resumo-comparacao__delta-label">Variação</span>
                <span class="resumo-comparacao__delta-text tabular-nums">${deltaLiquido >= 0 ? "+" : ""}R$ ${deltaLiquido.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}${pctVsAnt != null ? ` · ${pctVsAnt >= 0 ? "+" : ""}${pctVsAnt.toFixed(1)}%` : ""}</span>
            </div>
        </div>

    </div>
    `;

    // 3. EXTRATO — ordem = ordem do array (permite reordenar livremente; data só informativa)
    let htmlExtrato = `
        <div class="bank-card extrato-card">
            <div class="extrato-head">
                <h3 class="extrato-title">Extrato</h3>
                <span class="extrato-hint">${listaMesAtual.length} lançamentos · arraste pela coluna ⋮⋮</span>
            </div>
            <div class="container-extrato">`;

    listaMesAtual.forEach((item) => {
        const isEntrada = item.cat === "Entrada";
        const isPrevisto = item.pago === false;
        const icones = {"Pessoal": "🛒", "Necessidades": "🏠", "Guardar": "💰", "Entrada": "💵"};
        const icone = icones[item.cat] || "📝";
        const dataLabel = formatarDataExtrato(item.dataCriacao);
        const idJs = JSON.stringify(String(item.id));
        const descSafe = escapeHtmlModelo(item.desc);
        const origemSafe = escapeHtmlModelo(item.origem || "Carteira");
        const valorCls = isEntrada ? "extrato-valor extrato-valor--entrada tabular-nums" : "extrato-valor extrato-valor--saida tabular-nums";

        htmlExtrato += `
                <div class="item-transacao" data-item-id="${String(item.id).replace(/"/g, "&quot;")}" data-pago="${isPrevisto ? "false" : "true"}">
                    <div class="extrato-handle" aria-label="Arrastar para reordenar" title="Arrastar">⋮⋮</div>
                    <div class="item-transacao__main" onclick='abrirEdicao(${idJs})'>
                    <div class="extrato-icone" aria-hidden="true">${icone}</div>
                    <div class="extrato-info">
                        <div class="extrato-desc">${descSafe}</div>
                        <div class="extrato-meta">${origemSafe}${dataLabel ? " · " + dataLabel : ""}</div>
                    </div>
                    <div class="extrato-valores">
                    <div class="${valorCls}">
                        ${isEntrada ? "" : "- "}R$ ${parseFloat(item.valor).toFixed(2)}
                    </div>
                    ${isPrevisto ? `
                        <button type="button" class="extrato-btn-pendente"
                            onclick='confirmarPagamentoDireto(event, ${idJs})'>
                            Pendente
                        </button>
                    ` : ""}
                    </div>
                    <div class="extrato-chevron" aria-hidden="true">
                        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </div>
                    </div>
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
    let html = `<div class="meta-grupo"><h4 class="meta-grupo__titulo">${escapeHtmlModelo(titulo)} <span class="tabular-nums">(R$ ${totalEntrada.toFixed(2)})</span></h4>`;

    for (let cat in metasConfig) {
        const metaValor = totalEntrada * metasConfig[cat];
        const gasto = gastos[cat] || 0;
        const porcentagem = metaValor > 0 ? (gasto / metaValor) * 100 : 0;
        const sobra = metaValor - gasto;
        const fillBg = porcentagem > 100 ? "var(--red)" : "var(--inter-orange)";

        html += `
            <div class="meta-linha">
                <div class="meta-linha__top">
                    <span>${escapeHtmlModelo(cat)}</span>
                    <span class="meta-linha__pct tabular-nums">${porcentagem.toFixed(1)}%</span>
                </div>
                <div class="meta-barra-track">
                    <div class="meta-barra-fill" style="width: ${Math.min(porcentagem, 100)}%; background: ${fillBg};"></div>
                </div>
                <div class="meta-linha__foot">
                    <span class="tabular-nums">Gasto: R$ ${gasto.toFixed(2)}</span>
                    <span class="tabular-nums">Sobra: R$ ${sobra.toFixed(2)}</span>
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
    const corBarra = porcento >= 100 ? "var(--red)" : "var(--inter-orange)";
    return `
        <div class="bank-progress-container meta-barra-ui">
            <div class="meta-barra-ui__row">
                <span>${nome}</span><span class="tabular-nums">${porcento.toFixed(1)}%</span>
            </div>
            <div class="bank-progress-bg bank-progress-bg--metas">
                <div class="bank-progress-fill" style="width: ${porcento}%; background:${corBarra};"></div>
            </div>
            <div class="meta-barra-ui__foot">
                <span class="tabular-nums">Gasto: R$ ${atual.toFixed(2)}</span><span class="tabular-nums">Sobra: R$ ${(limite - atual).toFixed(2)}</span>
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
    ensureAnoMes(ano, mes).unshift(novoItem);

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
    if (!container || typeof Sortable === "undefined") return;

    if (sortableExtrato) {
        sortableExtrato.destroy();
        sortableExtrato = null;
    }

    sortableExtrato = Sortable.create(container, {
        animation: 150,
        handle: ".extrato-handle",
        draggable: ".item-transacao",
        filter: "button, a, input, textarea, select",
        preventOnFilter: true,
        ghostClass: "sortable-ghost",
        chosenClass: "sortable-chosen",
        scroll: true,
        forceAutoScrollFallback: true,
        bubbleScroll: true,
        scrollSensitivity: 48,
        scrollSpeed: 14,
        onEnd(evt) {
            if (evt.oldIndex === evt.newIndex) return;
            const mes = document.getElementById("filtroMes").value;
            const ano = getAnoSelecionado();
            const listaMes = dados[ano] && dados[ano][mes];
            if (!listaMes) return;
            const [movido] = listaMes.splice(evt.oldIndex, 1);
            listaMes.splice(evt.newIndex, 0, movido);
            persistDadosLocal(Date.now());
            queueMicrotask(() => {
                render();
                if (typeof salvarNoBanco === "function") salvarNoBanco();
            });
        },
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
        scroll: true,
        forceAutoScrollFallback: true,
        bubbleScroll: true,
        scrollSensitivity: 48,
        scrollSpeed: 14,
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
    const menuFixos = document.getElementById("menuFixosOpcoes");
    const btnFixos = document.getElementById("btnMasterFixos");
    if (menuFixos && btnFixos && !btnFixos.contains(e.target) && !menuFixos.contains(e.target)) {
        menuFixos.classList.remove("aberto");
        btnFixos.setAttribute("aria-expanded", "false");
        menuFixos.setAttribute("aria-hidden", "true");
        btnFixos.style.transform = "";
        btnFixos.style.background = "";
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

function fecharToastDesfazer() {
    const t = document.getElementById("toast-desfazer");
    if (t) t.style.display = "none";
    clearTimeout(desfazerToastTimer);
}

function mostrarToastDesfazer() {
    const t = document.getElementById("toast-desfazer");
    if (!t) return;
    t.style.display = "flex";
    clearTimeout(desfazerToastTimer);
    desfazerToastTimer = setTimeout(() => {
        ultimoRemovido = null;
        fecharToastDesfazer();
    }, 8000);
}

async function desfazerExclusao() {
    if (!ultimoRemovido) return;
    const { ano, mes, index, item } = ultimoRemovido;
    if (!dados[ano]) dados[ano] = {};
    if (!dados[ano][mes]) dados[ano][mes] = [];
    const insertAt = Math.min(Math.max(0, index), dados[ano][mes].length);
    dados[ano][mes].splice(insertAt, 0, item);
    ultimoRemovido = null;
    fecharToastDesfazer();
    persistDadosLocal(Date.now());
    render();
    await salvarDados();
}

async function executarRemocao() {
    const mesAtual = document.getElementById("filtroMes").value;
    const ano = getAnoSelecionado();
    const idParaRemover = indexParaRemover;

    if (!dados[ano] || !dados[ano][mesAtual]) return;
    const arr = dados[ano][mesAtual];
    const idx = arr.findIndex((item) => item.id == idParaRemover);
    if (idx === -1) {
        fecharConfirmacao();
        return;
    }
    ultimoRemovido = {
        ano,
        mes: mesAtual,
        index: idx,
        item: JSON.parse(JSON.stringify(arr[idx])),
    };
    dados[ano][mesAtual] = arr.filter((item) => item.id != idParaRemover);

    fecharConfirmacao();

    await salvarDados();
    render();
    mostrarToastDesfazer();
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

(function syncFurtivoIcon() {
    const btn = document.getElementById("btnFurtivo");
    if (btn) btn.classList.toggle("is-blurring", modoFurtivo);
})();
