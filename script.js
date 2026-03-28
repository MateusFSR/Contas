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
function login() {
    const user = document.getElementById("usuario")?.value;
    const pass = document.getElementById("senha")?.value;
    const erroMsg = document.getElementById("erro");

    if (user === "MateusFSR" && pass === "mateus21") {
        localStorage.setItem("logado", "true");
        window.location.href = "dashboard.html";
    } else {
        if (erroMsg) erroMsg.innerText = "Usuário ou senha incorretos!";
    }
}

function logout() {
    localStorage.removeItem("logado");
    window.location.href = "index.html";
}

function verificarAcesso() {
    if (localStorage.getItem("logado") !== "true" && !window.location.href.includes("index.html")) {
        window.location.href = "index.html";
    }
}

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

// ==========================================================================
// LÓGICA DE CRUD
// ==========================================================================
function adicionar() {
    const desc = document.getElementById("desc");
    const valor = document.getElementById("valor");
    const cat = document.getElementById("cat");
    const origem = document.getElementById("origem");
    const mes = document.getElementById("filtroMes").value;

    if (!desc.value || !valor.value) {
        alert("Preencha a descrição e o valor!");
        return;
    }

    const novoItem = {
        id: Date.now(),
        desc: desc.value,
        valor: parseFloat(valor.value),
        cat: cat.value,
        origem: cat.value === "Entrada" ? null : (origem ? origem.value : "Pagamento"),
        dataCriacao: new Date().toISOString()
    };

    if (!dados[mes]) dados[mes] = [];
    dados[mes].push(novoItem);
    
    desc.value = "";
    valor.value = "";
    
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
        
        // Remove do array
        dados[mesAtual].splice(indexParaRemover, 1);
        
        // Salva no LocalStorage para não perder
        localStorage.setItem("dados", JSON.stringify(dados));
        
        // Fecha o modal e limpa a variável
        fecharConfirmacao();
        
        // Atualiza a tela
        render();
        
        // MOSTRA O CHECKMARK ANIMADO NO TOAST!
        mostrarToastSucesso("Lançamento removido!");
    }
}

function fecharConfirmacao() {
    document.getElementById("modalConfirmarExclusao").style.display = "none";
    indexParaRemover = null;
}

function editarCampo(index, campo, novoValor) {
    const mes = document.getElementById("filtroMes").value;
    if (campo === "valor") {
        dados[mes][index][campo] = parseFloat(novoValor) || 0;
    } else {
        dados[mes][index][campo] = novoValor;
    }
    localStorage.setItem("dados", JSON.stringify(dados));
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

    // Lógica de cálculos
    let totalEntradas = 0, totalSaidas = 0, pagIn = 0, adiIn = 0;
    let limiteUsadoNoMes = 0;
    
    let gastosMeta = {
        Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
        Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
    };

    dados[mesAtualNome].forEach(item => {
        if (item.cat === "Entrada") {
            totalEntradas += item.valor;
            if (item.desc.toLowerCase().includes("pagamento")) pagIn += item.valor;
            if (item.desc.toLowerCase().includes("adiantamento")) adiIn += item.valor;
        } else {
            totalSaidas += item.valor;
            if (item.origem === "Crédito-Pag") {
                limiteUsadoNoMes += item.valor;
                gastosMeta.Pagamento.Pessoal += item.valor;
            } 
            else if (item.origem === "Crédito-Adi") {
                limiteUsadoNoMes += item.valor;
                gastosMeta.Adiantamento.Pessoal += item.valor;
            }
            else {
                let ori = item.origem || "Pagamento";
                if (gastosMeta[ori] && gastosMeta[ori][item.cat] !== undefined) {
                    gastosMeta[ori][item.cat] += item.valor;
                }
            }
        }
    });

    let totalCaixinhaHistorico = 0;
    for (let i = 0; i <= indexMesAtual; i++) {
        const nomeM = mesesAno[i];
        if (dados[nomeM]) {
            dados[nomeM].forEach(item => { if (item.cat === "Guardar") totalCaixinhaHistorico += item.valor; });
        }
    }

    const limiteDisponivel = totalCaixinhaHistorico - limiteUsadoNoMes;
    const porcentagemGastoLimite = totalCaixinhaHistorico > 0 ? (limiteUsadoNoMes / totalCaixinhaHistorico) * 100 : 0;
    const estiloBrilho = porcentagemGastoLimite >= 90 ? `box-shadow: 0 0 15px #ff4d4d; animation: pulseGlow 1.5s infinite alternate;` : '';

    // 1. Renderização do Painel de Resumo e Cards de Saldo
    resumo.innerHTML = `
    <div class="bank-grid">
        <div class="bank-card full no-padding">
            <div style="padding: 20px; display: flex; flex-wrap: wrap; justify-content: space-between; align-items: flex-start; gap: 20px;">
                <div style="flex: 1; min-width: 200px; border-right: 1px solid rgba(128,128,128,0.2); padding-right: 20px;" class="res-border-none">
                    <span class="bank-label">SALDO TOTAL EM CONTA</span>
                    <strong class="bank-value" id="vTotal" style="display: block; font-size: 28px; margin: 5px 0; color: var(--text-color, inherit);">R$ 0,00</strong>
                    
                    <div style="display: flex; gap: 15px; margin-top: 5px; flex-wrap: wrap;">
                        <button onclick="abrirModal()" style="background: none; border: none; color: var(--inter-orange); font-weight: 700; font-size: 11px; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 5px; text-transform: lowercase;">
                            <span style="font-size: 18px; line-height: 0; margin-top: -2px;">›</span> novo lançamento
                        </button>
                        <button onclick="toggleMetasFlutuante()" style="background: none; border: none; color: #888; font-weight: 700; font-size: 11px; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 5px; text-transform: lowercase;">
                            <span style="font-size: 14px; line-height: 0;">📊</span> ver metas
                        </button>
                    </div>
                </div>
                
                <div style="flex: 1; min-width: 200px; display: flex; flex-direction: column; align-items: flex-start;">
                    <span class="bank-label">LIMITE DISPONÍVEL (CAIXINHA)</span>
                    <strong class="bank-value" style="font-size: 24px; margin: 5px 0; color: ${limiteDisponivel < 0 ? '#ff4d4d' : 'var(--text-color, inherit)'}">
                        R$ ${limiteDisponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </strong>
                    <div style="width: 100%; max-width: 220px; height: 6px; background: #2ECC71; border-radius: 3px; position: relative; margin-top: 10px;">
                        <div style="width: ${Math.min(porcentagemGastoLimite, 100)}%; height: 100%; background: #ff4d4d; border-radius: 3px; transition: width 0.5s ease; ${estiloBrilho}"></div>
                    </div>
                </div>
            </div>
        </div>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 10px; width: 100%; margin-top: 10px;">
            <div class="bank-card" style="padding: 10px 15px; min-height: auto;">
                <span class="bank-label" style="font-size: 9px; margin-bottom: 2px;">SALDO PAGAMENTO</span>
                <strong class="bank-value" id="vPag" style="font-size: 16px; color: var(--text-color, inherit);">R$ 0,00</strong>
            </div>
            <div class="bank-card" style="padding: 10px 15px; min-height: auto;">
                <span class="bank-label" style="font-size: 9px; margin-bottom: 2px;">SALDO ADIANTAMENTO</span>
                <strong class="bank-value" id="vAdi" style="font-size: 16px; color: var(--text-color, inherit);">R$ 0,00</strong>
            </div>
        </div>
    </div>

    <div id="modalMetas" class="modal-overlay" style="display:none; position: fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.8); z-index:20000; justify-content:center; align-items:center; backdrop-filter: blur(8px); padding: 15px;">
        <div class="bank-card" style="width: 100%; max-width: 700px; max-height: 90vh; overflow-y: auto; position: relative; padding: clamp(15px, 5vw, 35px); border: 1px solid #333; border-radius: 20px; background: var(--card-bg, #1a1a1a);">
            <button onclick="toggleMetasFlutuante()" style="position: absolute; top: 15px; right: 15px; background: none; border: none; color: var(--text-color, #fff); font-size: 28px; cursor: pointer;">&times;</button>
            <h3 style="margin-bottom: 25px; color: var(--inter-orange); font-size: 18px;">📊 Planejamento de Metas</h3>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: clamp(20px, 5vw, 40px);">
                ${renderizarBlocoMeta("Do Pagamento", pagIn, gastosMeta.Pagamento)}
                ${renderizarBlocoMeta("Do Adiantamento", adiIn, gastosMeta.Adiantamento)}
            </div>
        </div>
    </div>
    `;

    // 2. Tabela com Suporte a Reordenação Manual
    let htmlTabela = `
        <div class="bank-card" style="margin-top:20px">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px; flex-wrap: wrap; gap: 10px;">
                <h3 style="font-size: 14px;">Extrato Detalhado</h3>
                <span style="color:var(--inter-gray); font-size:12px">${dados[mesAtualNome].length} lançamentos</span>
            </div>
            <div class="bank-table-container" style="overflow-x: auto;">
                <table class="bank-table" style="min-width: 450px;">
                    <thead>
                        <tr style="text-align:left; color:var(--inter-gray); font-size:11px; text-transform: uppercase;">
                            <th style="padding:10px">Descrição</th>
                            <th style="padding:10px">Valor</th>
                            <th style="padding:10px">Categoria</th>
                            <th style="padding:10px; text-align: center;">Ações</th>
                        </tr>
                    </thead>
                    <tbody id="tabela-corpo">`;

    dados[mesAtualNome].forEach((item, i) => {
        htmlTabela += `
            <tr data-id="${i}">
                <td><input class="input-transparente" style="width: 100%" value="${item.desc}" onchange="editarCampo(${i}, 'desc', this.value)"></td>
                <td class="${item.cat === 'Entrada' ? 'txt-green' : 'txt-red'}">
                    R$ <input type="number" step="0.01" class="input-transparente" style="width:70px" value="${item.valor}" onchange="editarCampo(${i}, 'valor', this.value)">
                </td>
                <td>
                    <select class="input-transparente" onchange="editarCampo(${i}, 'cat', this.value); render();">
                        <option value="Entrada" ${item.cat === 'Entrada' ? 'selected' : ''}>Entrada</option>
                        <option value="Necessidades" ${item.cat === 'Necessidades' ? 'selected' : ''}>Necessidades</option>
                        <option value="Pessoal" ${item.cat === 'Pessoal' ? 'selected' : ''}>Pessoal</option>
                        <option value="Guardar" ${item.cat === 'Guardar' ? 'selected' : ''}>Guardar</option>
                    </select>
                </td>
                <td style="display: flex; align-items: center; justify-content: center; gap: 12px; padding: 10px;">
                    <span class="handle" style="cursor: grab; color: var(--inter-gray); font-size: 20px; user-select: none;">≡</span>
                    <button onclick="remover(${i})" class="btn-clear" style="cursor:pointer; padding: 5px;">✕</button>
                </td>
            </tr>`;
    });

    htmlTabela += `</tbody></table></div></div>`;
    lista.innerHTML = htmlTabela;

    // 3. Inicialização de Componentes e Animações
    if (typeof initSortable === "function") initSortable();
    
    document.querySelectorAll(".mes-btn").forEach(btn => {
        btn.classList.toggle("ativo", btn.innerText.trim() === mesAtualNome);
    });

    animarValoresTela(totalEntradas - totalSaidas, pagIn, adiIn);
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
    const desc = document.getElementById("desc").value;
    const valor = document.getElementById("valor").value;

    if (!desc || !valor) {
        // Se quiser, pode criar um toast de erro também, mas por ora:
        alert("Preencha todos os campos!"); 
        return;
    }

    adicionar(); // Sua lógica original de salvar
    
    fecharModal(); // Fecha o modal de input
    mostrarToastSucesso(); // MOSTRA A ANIMAÇÃO DO CHECK NO CANTO DA TELA
    
    // Limpa os campos
    document.getElementById("desc").value = "";
    document.getElementById("valor").value = "";
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
    const rows = document.querySelectorAll("#tabelaDrag tbody tr");
    let draggedIndex = null;
    rows.forEach(row => {
        row.addEventListener("dragstart", (e) => { draggedIndex = e.target.dataset.index; e.target.classList.add("dragging"); });
        row.addEventListener("dragover", (e) => e.preventDefault());
        row.addEventListener("drop", (e) => {
            const targetIndex = e.target.closest("tr").dataset.index;
            const mes = document.getElementById("filtroMes").value;
            const item = dados[mes].splice(draggedIndex, 1)[0];
            dados[mes].splice(targetIndex, 0, item);
            localStorage.setItem("dados", JSON.stringify(dados));
            render();
        });
    });
}

function toggleMetasFlutuante() {
    const modal = document.getElementById("modalMetas");
    if (modal) {
        if (modal.style.display === "none" || modal.style.display === "") {
            modal.style.display = "flex";
            // Garante que o scroll do corpo trave ao abrir o modal
            document.body.style.overflow = "hidden";
        } else {
            modal.style.display = "none";
            document.body.style.overflow = "auto";
        }
    } else {
        console.error("Erro: Elemento #modalMetas não encontrado no DOM.");
    }
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
