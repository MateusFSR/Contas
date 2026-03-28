// ==========================================================================
// CONFIGURAÇÕES GERAIS E BANCO DE DADOS (SUPABASE)
// ==========================================================================
const SUPABASE_URL = "https://amqbggvxcyutlzubadio.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcWJnZ3Z4Y3l1dGx6dWJhZGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzc1NDksImV4cCI6MjA5MDIxMzU0OX0.PtlDWAmK7wCmFAs4QZIv3CSnlbqS11v8DCXw6K7NTvg"; 
const NOME_USUARIO = "mateusfsr";

// Estado Global da Aplicação
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
        btn.innerHTML = "<span>⏳</span><br>Salvando";
        btn.disabled = true;
    }

    try {
        // Verifica se registro já existe para o usuário
        const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}`, {
            headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
        });
        const existe = await checkRes.json();

        const payload = { usuario: NOME_USUARIO, dados_json: dados };
        let finalRes;

        if (existe && existe.length > 0) {
            // Atualiza (PATCH)
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
            // Cria (POST)
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
            alert("✨ Sincronização concluída com sucesso!");
            localStorage.setItem("dados", JSON.stringify(dados));
        } else {
            throw new Error("Erro na resposta do servidor");
        }
    } catch (error) {
        console.error(error);
        alert("❌ Ocorreu um erro ao salvar os dados.");
    } finally {
        if (btn) {
            btn.innerHTML = "<span>☁️</span><br>Salvar";
            btn.disabled = false;
        }
    }
}

// ==========================================================================
// LÓGICA DE CRUD E MANIPULAÇÃO DE DADOS
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
    
    // Limpar campos
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
    // Não chamamos render() aqui para não perder o foco do input durante a digitação
}

// ==========================================================================
// INTERFACE E RENDERIZAÇÃO (ESTILO BANCO INTER)
// ==========================================================================
function render() {
    const mes = document.getElementById("filtroMes").value;
    const lista = document.getElementById("lista");
    const resumo = document.getElementById("resumo");

    if (!dados[mes]) dados[mes] = [];

    let totalEntradas = 0;
    let totalSaidas = 0;
    let pagIn = 0;
    let adiIn = 0;
    
    // Acumuladores para Metas
    let gastos = {
        Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
        Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
    };

    // Processamento dos dados do mês
    dados[mes].forEach(item => {
        if (item.cat === "Entrada") {
            totalEntradas += item.valor;
            if (item.desc.toLowerCase().includes("pagamento")) pagIn += item.valor;
            if (item.desc.toLowerCase().includes("adiantamento")) adiIn += item.valor;
        } else {
            totalSaidas += item.valor;
            let ori = item.origem || "Pagamento";
            if (gastos[ori] && gastos[ori][item.cat] !== undefined) {
                gastos[ori][item.cat] += item.valor;
            }
        }
    document.querySelectorAll(".mes-btn").forEach(btn => {
    const mesAtual = document.getElementById("filtroMes").value;
    btn.classList.toggle("ativo", btn.getAttribute("onclick").includes(`'${mesAtual}'`));
  });    
    });

    // Atualização do Resumo (Boxes Separadas)
    resumo.innerHTML = `
        <div class="bank-grid">
            <div class="bank-card full">
                <span class="bank-label">Saldo Total em Conta</span>
                <strong class="bank-value" id="vTotal">R$ 0,00</strong>
            </div>
            <div class="bank-card half">
                <span class="bank-label">Saldo Pagamento</span>
                <strong class="bank-value sub" id="vPag">R$ 0,00</strong>
            </div>
            <div class="bank-card half">
                <span class="bank-label">Saldo Adiantamento</span>
                <strong class="bank-value sub" id="vAdi">R$ 0,00</strong>
            </div>
        </div>

        <div class="bank-card">
            <h4 class="section-title">📊 Metas de Utilização</h4>
            <div class="meta-container">
                <div class="meta-col">
                    <h5>Do Pagamento (R$ ${pagIn.toFixed(2)})</h5>
                    ${gerarBarraUI("Necessidades", gastos.Pagamento.Necessidades, pagIn * 0.4)}
                    ${gerarBarraUI("Pessoal", gastos.Pagamento.Pessoal, pagIn * 0.3)}
                    ${gerarBarraUI("Guardar", gastos.Pagamento.Guardar, pagIn * 0.3)}
                </div>
                <div class="meta-col">
                    <h5>Do Adiantamento (R$ ${adiIn.toFixed(2)})</h5>
                    ${gerarBarraUI("Necessidades", gastos.Adiantamento.Necessidades, adiIn * 0.4)}
                    ${gerarBarraUI("Pessoal", gastos.Adiantamento.Pessoal, adiIn * 0.3)}
                    ${gerarBarraUI("Guardar", gastos.Adiantamento.Guardar, adiIn * 0.3)}
                </div>
            </div>
        </div>
    `;

    // Renderização da Tabela
    let htmlTabela = `
        <div class="bank-card">
            <div style="display:flex; justify-content:space-between; align-items:center">
                <h3>Extrato Detalhado</h3>
                <span style="color:var(--inter-gray); font-size:12px">${dados[mes].length} lançamentos</span>
            </div>
            <div class="bank-table-container">
                <table class="bank-table" id="tabelaDrag">
                    <thead>
                        <tr style="text-align:left; color:var(--inter-gray); font-size:12px">
                            <th style="padding:10px">DESCRIÇÃO</th>
                            <th style="padding:10px">VALOR</th>
                            <th style="padding:10px">CATEGORIA</th>
                            <th style="padding:10px">AÇÃO</th>
                        </tr>
                    </thead>
                    <tbody>`;

    dados[mes].forEach((item, i) => {
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

    // Disparar funções auxiliares
    ativarDragAndDrop();
    animarValoresTela(totalEntradas - totalSaidas, pagIn, adiIn);
}

// ==========================================================================
// COMPONENTES DE UI E ANIMAÇÕES
// ==========================================================================
function gerarBarraUI(nome, atual, limite) {
    const porcento = limite > 0 ? Math.min((atual / limite) * 100, 100) : 0;
    const corBarra = porcento >= 100 ? "var(--red)" : "var(--inter-orange)";
    const restante = limite - atual;

    return `
        <div class="bank-progress-container">
            <div class="progress-labels">
                <span>${nome}</span>
                <span>${porcento.toFixed(1)}%</span>
            </div>
            <div class="bank-progress-bg">
                <div class="bank-progress-fill" style="width: ${porcento}%; background-color: ${corBarra}"></div>
            </div>
            <div style="display:flex; justify-content:space-between">
                <small>Gasto: R$ ${atual.toFixed(2)}</small>
                <small style="color:${restante < 0 ? 'var(--red)' : ''}">Sobra: R$ ${restante.toFixed(2)}</small>
            </div>
        </div>
    `;
}

function animarValoresTela(total, pag, adi) {
    const formatar = (v) => "R$ " + v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    
    document.getElementById("vTotal").innerText = formatar(total);
    document.getElementById("vPag").innerText = formatar(pag);
    document.getElementById("vAdi").innerText = formatar(adi);
}

function mudarMes(novoMes) {
    document.getElementById("filtroMes").value = novoMes;
    // Atualizar botões se existirem
    document.querySelectorAll(".mes-btn").forEach(btn => {
    const clickAttr = btn.getAttribute("onclick");
    btn.classList.toggle("ativo", clickAttr && clickAttr.includes(`'${novoMes}'`));
    });
    render();
}

// ==========================================================================
// DASHBOARD E GRÁFICOS (CHART.JS)
// ==========================================================================
function abrirDashboard() {
    const modal = document.getElementById("dashboardModal");
    if (modal) {
        modal.classList.add("ativo");
        setTimeout(renderizarGraficosDashboard, 100);
    }
}

function fecharDashboard() {
    document.getElementById("dashboardModal").classList.remove("ativo");
}

function renderizarGraficosDashboard() {
    const mes = document.getElementById("filtroMes").value;
    const dadosMes = dados[mes] || [];

    let cats = { Necessidades: 0, Pessoal: 0, Guardar: 0 };
    let entradas = { Pagamento: 0, Adiantamento: 0 };

    dadosMes.forEach(item => {
        if (item.cat === "Entrada") {
            if (item.desc.toLowerCase().includes("pagamento")) entradas.Pagamento += item.valor;
            else entradas.Adiantamento += item.valor;
        } else {
            if (cats[item.cat] !== undefined) cats[item.cat] += item.valor;
        }
    });

    // Gráfico de Pizza (Distribuição de Receita)
    if (grafDistribuicao) grafDistribuicao.destroy();
    const ctx1 = document.getElementById('graficoDistribuicao')?.getContext('2d');
    if (ctx1) {
        grafDistribuicao = new Chart(ctx1, {
            type: 'doughnut',
            data: {
                labels: ['Pagamento', 'Adiantamento'],
                datasets: [{
                    data: [entradas.Pagamento, entradas.Adiantamento],
                    backgroundColor: ['#FF7A00', '#FFB366'],
                    borderWidth: 0
                }]
            },
            options: { plugins: { legend: { position: 'bottom' } } }
        });
    }

    // Gráfico de Barras (Gastos por Categoria)
    if (grafCategoria) grafCategoria.destroy();
    const ctx2 = document.getElementById('graficoCategoria')?.getContext('2d');
    if (ctx2) {
        grafCategoria = new Chart(ctx2, {
            type: 'bar',
            data: {
                labels: ['Necessidades', 'Pessoal', 'Guardar'],
                datasets: [{
                    label: 'Gastos Reais',
                    data: [cats.Necessidades, cats.Pessoal, cats.Guardar],
                    backgroundColor: '#FF7A00'
                }]
            },
            options: { scales: { y: { beginAtZero: true } } }
        });
    }
}

// ==========================================================================
// IMPORTAÇÃO / EXPORTAÇÃO (EXCEL)
// ==========================================================================
function exportarExcel() {
    try {
        let rows = [];
        for (let m in dados) {
            dados[m].forEach(item => {
                rows.push({
                    "Mês": m,
                    "Descrição": item.desc,
                    "Valor": item.valor,
                    "Categoria": item.cat,
                    "Origem": item.origem || "N/A"
                });
            });
        }
        const worksheet = XLSX.utils.json_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Finanças");
        XLSX.writeFile(workbook, `Financeiro_Inter_${NOME_USUARIO}.xlsx`);
    } catch (e) {
        alert("Erro ao exportar: Verifique se a biblioteca XLSX está carregada.");
    }
}

function importarExcel(input) {
    const file = input.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const json = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        
        // Processar JSON para o formato do sistema
        let novosDados = {};
        json.forEach(row => {
            const m = row["Mês"];
            if (!novosDados[m]) novosDados[m] = [];
            novosDados[m].push({
                desc: row["Descrição"],
                valor: parseFloat(row["Valor"]),
                cat: row["Categoria"],
                origem: row["Origem"] === "N/A" ? null : row["Origem"]
            });
        });

        if (Object.keys(novosDados).length > 0) {
            dados = novosDados;
            localStorage.setItem("dados", JSON.stringify(dados));
            render();
            alert("✅ Importação realizada com sucesso!");
        }
    };
    reader.readAsArrayBuffer(file);
}

// ==========================================================================
// DRAG AND DROP (REORDENAÇÃO)
// ==========================================================================
function ativarDragAndDrop() {
    const rows = document.querySelectorAll("#tabelaDrag tbody tr");
    let draggedRowIndex = null;

    rows.forEach(row => {
        row.addEventListener("dragstart", (e) => {
            draggedRowIndex = e.target.getAttribute("data-index");
            e.target.classList.add("dragging");
        });

        row.addEventListener("dragover", (e) => e.preventDefault());

        row.addEventListener("drop", (e) => {
            e.preventDefault();
            const targetRowIndex = e.target.closest("tr").getAttribute("data-index");
            const mes = document.getElementById("filtroMes").value;
            
            // Reordenar array
            const movedItem = dados[mes].splice(draggedRowIndex, 1)[0];
            dados[mes].splice(targetRowIndex, 0, movedItem);
            
            localStorage.setItem("dados", JSON.stringify(dados));
            render();
        });

        row.addEventListener("dragend", (e) => e.target.classList.remove("dragging"));
    });
}

// ==========================================================================
// INICIALIZAÇÃO
// ==========================================================================
window.addEventListener("load", () => {
    verificarAcesso();
    
    // Aplicar Dark Mode se salvo
    if (localStorage.getItem("darkMode") === "true") {
        document.body.classList.add("dark-mode");
    }

    carregarDadosDoBanco();
});

function toggleDarkMode() {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("darkMode", isDark);
}
