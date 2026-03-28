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
    if (btn) {
        btn.innerHTML = "<span>⏳</span><br><small>Salvando</small>";
        btn.disabled = true;
    }

    try {
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const existe = await checkRes.json();

        const payload = { usuario: NOME_USUARIO, dados_json: dados };
        let finalRes;

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

        if (finalRes.ok) {
            alert("✨ Sincronização concluída!");
            localStorage.setItem("dados", JSON.stringify(dados));
        } else {
            throw new Error("Erro no servidor");
        }
    } catch (error) {
        alert("❌ Erro ao salvar.");
    } finally {
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

function remover(index) {
    const mes = document.getElementById("filtroMes").value;
    if (confirm("Deseja realmente excluir este lançamento?")) {
        dados[mes].splice(index, 1);
        localStorage.setItem("dados", JSON.stringify(dados));
        render();
    }
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

    let totalEntradas = 0, totalSaidas = 0, pagIn = 0, adiIn = 0;
    let limiteUsadoNoMes = 0;
    
    let gastos = {
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
            if (item.origem === "Crédito") {
                limiteUsadoNoMes += item.valor;
                if (gastos.Pagamento[item.cat] !== undefined) gastos.Pagamento[item.cat] += item.valor;
            } else {
                let ori = item.origem || "Pagamento";
                if (gastos[ori] && gastos[ori][item.cat] !== undefined) gastos[ori][item.cat] += item.valor;
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

    resumo.innerHTML = `
    <div class="bank-grid">
        <div class="bank-card full no-padding">
            <div style="padding: 20px; display: flex; justify-content: space-between; align-items: center; gap: 20px;">
                <div style="flex: 1; border-right: 1px solid rgba(255,255,255,0.1); padding-right: 20px;">
                    <span class="bank-label">Saldo Total em Conta</span>
                    <strong class="bank-value" id="vTotal" style="display: block;">R$ 0,00</strong>
                    <button onclick="abrirModal()" style="background: none; border: none; color: var(--inter-orange); font-weight: 700; font-size: 12px; cursor: pointer; padding: 5px 0; display: flex; align-items: center; gap: 5px; text-transform: uppercase; margin-top: 5px;">
                        <span style="font-size: 16px;">+</span> Novo Lançamento
                    </button>
                </div>
                <div style="flex: 1;">
                    <span class="bank-label">Limite Disponível (Caixinha)</span>
                    <strong class="bank-value" style="font-size: 22px; color: ${limiteDisponivel < 0 ? '#ff4d4d' : 'inherit'}">
                        R$ ${limiteDisponivel.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </strong>
                    <small style="display:block; color:var(--inter-gray); font-size:10px;">Acumulado: R$ ${totalCaixinhaHistorico.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</small>
                </div>
            </div>
        </div>
        <div class="bank-card half"><span class="bank-label">Saldo Pagamento</span><strong class="bank-value sub" id="vPag">R$ 0,00</strong></div>
        <div class="bank-card half"><span class="bank-label">Saldo Adiantamento</span><strong class="bank-value sub" id="vAdi">R$ 0,00</strong></div>
    </div>

    <div class="bank-card">
        <h4 class="section-title">📊 Metas de Utilização</h4>
        <div class="meta-container" style="display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-top: 15px;">
            <div class="meta-col">
                <h5 style="margin-bottom: 15px; font-size: 12px; opacity: 0.8;">Do Pagamento (R$ ${pagIn.toFixed(2)})</h5>
                ${gerarBarraUI("Necessidades", gastos.Pagamento.Necessidades, pagIn * 0.4)}
                ${gerarBarraUI("Pessoal", gastos.Pagamento.Pessoal, pagIn * 0.3)}
                ${gerarBarraUI("Guardar", gastos.Pagamento.Guardar, pagIn * 0.3)}
            </div>
            <div class="meta-col">
                <h5 style="margin-bottom: 15px; font-size: 12px; opacity: 0.8;">Do Adiantamento (R$ ${adiIn.toFixed(2)})</h5>
                ${gerarBarraUI("Necessidades", gastos.Adiantamento.Necessidades, adiIn * 0.4)}
                ${gerarBarraUI("Pessoal", gastos.Adiantamento.Pessoal, adiIn * 0.3)}
                ${gerarBarraUI("Guardar", gastos.Adiantamento.Guardar, adiIn * 0.3)}
            </div>
        </div>
    </div>
    `;

    let htmlTabela = `
        <div class="bank-card">
            <h3>Extrato Detalhado</h3>
            <div class="bank-table-container">
                <table class="bank-table" id="tabelaDrag">
                    <thead>
                        <tr><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Ação</th></tr>
                    </thead>
                    <tbody>`;

    dados[mesAtualNome].forEach((item, i) => {
        htmlTabela += `
            <tr draggable="true" data-index="${i}">
                <td><input class="input-transparente" value="${item.desc}" onchange="editarCampo(${i}, 'desc', this.value)"></td>
                <td class="${item.cat === 'Entrada' ? 'txt-green' : 'txt-red'}">
                    R$ <input type="number" step="0.01" class="input-transparente" style="width:80px" value="${item.valor}" onchange="editarCampo(${i}, 'valor', this.value)">
                </td>
                <td>
                    <select class="input-transparente" onchange="editarCampo(${i}, 'cat', this.value); render();">
                        <option value="Entrada" ${item.cat === 'Entrada' ? 'selected' : ''}>Entrada</option>
                        <option value="Necessidades" ${item.cat === 'Necessidades' ? 'selected' : ''}>Necessidades</option>
                        <option value="Pessoal" ${item.cat === 'Pessoal' ? 'selected' : ''}>Pessoal</option>
                        <option value="Guardar" ${item.cat === 'Guardar' ? 'selected' : ''}>Guardar</option>
                    </select>
                </td>
                <td><button onclick="remover(${i})" class="btn-clear">✕</button></td>
            </tr>`;
    });

    htmlTabela += `</tbody></table></div></div>`;
    lista.innerHTML = htmlTabela;

    ativarDragAndDrop();
    animarValoresTela(totalEntradas - totalSaidas, pagIn, adiIn);
    
    document.querySelectorAll(".mes-btn").forEach(btn => {
        btn.classList.toggle("ativo", btn.innerText.trim() === mesAtualNome);
    });
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
function adicionarComModal() { adicionar(); fecharModal(); }

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
