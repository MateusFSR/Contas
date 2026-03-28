// ================= CONFIGURAÇÃO SUPABASE =================
const SUPABASE_URL = "https://amqbggvxcyutlzubadio.supabase.co"; // Ex: https://xyz.supabase.co
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtcWJnZ3Z4Y3l1dGx6dWJhZGlvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2Mzc1NDksImV4cCI6MjA5MDIxMzU0OX0.PtlDWAmK7wCmFAs4QZIv3CSnlbqS11v8DCXw6K7NTvg"; 
const NOME_USUARIO = "mateusfsr"; // Identificador único para seus dados

// ================= DADOS INICIAIS =================
let dadosPadrao = {
  Julho: [
    { desc: "Pagamento", valor: 1800, cat: "Entrada" },
    { desc: "Adiantamento", valor: 1200, cat: "Entrada" }
  ]
};

// Tenta carregar do LocalStorage apenas como fallback imediato
let dados = JSON.parse(localStorage.getItem("dados")) || dadosPadrao;

// Instâncias Globais dos Gráficos (para destruí-los antes de redesenhar)
let grafDistribuicao, grafCategoria, grafLimite;

// ================= SINCRONIZAÇÃO COM O BANCO (SUPABASE) =================

async function carregarDadosDoBanco() {
  console.log("Conectando ao banco de dados...");
  const btnSalvar = document.getElementById("btnSalvar");
  if(btnSalvar) btnSalvar.style.display = "block"; // Garante que o botão de salvar apareça

  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}&select=dados_json`, {
      headers: {
        "apikey": SUPABASE_KEY,
        "Authorization": `Bearer ${SUPABASE_KEY}`
      }
    });

    const resultado = await res.json();

    if (resultado && resultado.length > 0) {
      dados = resultado[0].dados_json;
      console.log("✅ Dados carregados do Supabase.");
    } else {
      console.warn("⚠️ Nenhum dado encontrado no banco. Usando local/padrão.");
    }
  } catch (erro) {
    console.error("Erro na conexão com Supabase:", erro);
  }
  render();
}

async function salvarNoBanco() {
  const btn = document.getElementById("btnSalvar");
  if (btn) {
    btn.innerHTML = "⏳<br>Salvando"; // Usando <br> para quebrar o texto no círculo
    btn.disabled = true;
  }

  try {
    // 1. Verifica se já existe um registro para este usuário
    const verificar = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}`, {
        headers: { "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}` }
    });
    const existe = await verificar.json();

    let res;
    // 2. Se existe, atualiza (PATCH). Se não, cria (POST).
    if (existe && existe.length > 0) {
      res = await fetch(`${SUPABASE_URL}/rest/v1/financas?usuario=eq.${NOME_USUARIO}`, {
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
      res = await fetch(`${SUPABASE_URL}/rest/v1/financas`, {
        method: 'POST',
        headers: {
          "apikey": SUPABASE_KEY,
          "Authorization": `Bearer ${SUPABASE_KEY}`,
          "Content-Type": "application/json",
          "Prefer": "return=minimal"
        },
        body: JSON.stringify({ usuario: NOME_USUARIO, dados_json: dados })
      });
    }

    if (res.ok) {
      alert("✅ Sincronizado!");
      localStorage.setItem("dados", JSON.stringify(dados));
    } else {
      alert("❌ Erro ao salvar no banco.");
    }
  } catch (erro) {
    console.error(erro);
    alert("❌ Falha na comunicação com o servidor.");
  } finally {
    if (btn) {
      btn.innerHTML = "☁️<br>Salvar";
      btn.disabled = false;
    }
  }
}

// ================= LOGIN (Se houver) =================
function login() {
  const user = document.getElementById("usuario").value;
  const pass = document.getElementById("senha").value;

  if (user === "MateusFSR" && pass === "mateus21") {
    window.location.href = "dashboard.html"; // Redireciona para onde o sistema estiver
  } else {
    document.getElementById("erro").innerText = "Login inválido!";
  }
}

// ================= CONTROLE DO MODAL DASHBOARD =================

function abrirDashboard() {
  const modal = document.getElementById("dashboardModal");
  if (modal) {
    modal.classList.add("ativo");
    // Renderiza os gráficos somente quando o modal abrir
    renderizarGraficosDashboard();
  }
}

function fecharDashboard() {
  const modal = document.getElementById("dashboardModal");
  if (modal) {
    modal.classList.remove("ativo");
  }
}

// Fecha o modal se o usuário clicar fora do conteúdo branco
window.onclick = function(event) {
  const modal = document.getElementById("dashboardModal");
  if (event.target == modal) {
    fecharDashboard();
  }
}

// ================= RENDERIZAÇÃO DOS GRÁFICOS (CHART JS) =================

function renderizarGraficosDashboard() {
  const mes = document.getElementById("filtroMes").value;
  const dadosMes = dados[mes] || [];

  // 1. Cálculos de Dados
  let totalPagamentoIn = 0;
  let totalAdiantamentoIn = 0;
  let gastosPorCategoria = { Necessidades: 0, Pessoal: 0, Guardar: 0 };
  let totalGeralGasto = 0;

  dadosMes.forEach(item => {
    if (item.cat === "Entrada") {
      if (item.desc.toLowerCase().includes("pagamento")) totalPagamentoIn += item.valor;
      if (item.desc.toLowerCase().includes("adiantamento")) totalAdiantamentoIn += item.valor;
    } else {
      if (gastosPorCategoria[item.cat] !== undefined) {
        gastosPorCategoria[item.cat] += item.valor;
        totalGeralGasto += item.valor;
      }
    }
  });

  const totalEntradaValida = totalPagamentoIn + totalAdiantamentoIn;
  // Meta de gasto (70% das entradas) e meta de guardar (30%)
  const metaGastoTotal = totalEntradaValida * 0.7;

  // 2. Configurações de Cores
  const coresCategoriass = {
    Necessidades: '#f97316', // Laranja
    Pessoal: '#3b82f6',     // Azul
    Guardar: '#10b981'      // Verde
  };

  // --- GRÁFICO 1: DISTRIBUIÇÃO DE ENTRADAS (PIZZA) ---
  if (grafDistribuicao) grafDistribuicao.destroy();
  const ctx1 = document.getElementById('graficoDistribuicao');
  if (ctx1) {
    grafDistribuicao = new Chart(ctx1, {
      type: 'pie',
      data: {
        labels: ['Pagamento', 'Adiantamento'],
        datasets: [{
          data: [totalPagamentoIn, totalAdiantamentoIn],
          backgroundColor: [coresCategoriass.Necessidades, '#fdb17d'] // Laranja forte, laranja claro
        }]
      },
      options: {
        plugins: { legend: { position: 'bottom' } },
        aspectRatio: 1.5 // Deixa o gráfico mais compacto
      }
    });
  }

  // --- GRÁFICO 2: GASTOS POR CATEGORIA (BARRA VERTICAL) ---
  if (grafCategoria) grafCategoria.destroy();
  const ctx2 = document.getElementById('graficoCategoria');
  if (ctx2) {
    grafCategoria = new Chart(ctx2, {
      type: 'bar',
      data: {
        labels: ['Necessidades', 'Pessoal', 'Guardar'],
        datasets: [{
          label: 'Gasto Real (R$)',
          data: [
            gastosPorCategoria.Necessidades,
            gastosPorCategoria.Pessoal,
            gastosPorCategoria.Guardar
          ],
          backgroundColor: [coresCategoriass.Necessidades, coresCategoriass.Pessoal, coresCategoriass.Guardar]
        }]
      },
      options: {
        indexAxis: 'y', // Barra Horizontal
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true, ticks: { callback: value => 'R$ ' + value } } }
      }
    });
  }

  // --- GRÁFICO 3: LIMITE UTILIZADO (BARRA HORIZONTAL DUPLA) ---
  if (grafLimite) grafLimite.destroy();
  const ctx3 = document.getElementById('graficoLimite');
  if (ctx3) {
    const percUtilizado = metaGastoTotal ? (totalGeralGasto / metaGastoTotal) * 100 : 0;
    const corBarraUtilizado = percUtilizado > 100 ? '#ef4444' : coresCategoriass.Guardar; // Vermelho se estourar

    grafLimite = new Chart(ctx3, {
      type: 'bar',
      data: {
        labels: ['Limite Total (70% das Entradas)'],
        datasets: [
          {
            label: 'Meta Máxima',
            data: [metaGastoTotal],
            backgroundColor: '#e2e8f0', // Cinza de fundo
            barThickness: 30
          },
          {
            label: 'Gasto Atual',
            data: [totalGeralGasto],
            backgroundColor: corBarraUtilizado,
            barThickness: 30
          }
        ]
      },
      options: {
        indexAxis: 'y', // Barra Horizontal
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.dataset.label}: R$ ${ctx.raw.toFixed(2)} (${percUtilizado.toFixed(0)}% do limite)`
            }
          }
        },
        scales: {
          x: { stacked: false, beginAtZero: true, ticks: { callback: value => 'R$ ' + value } },
          y: { stacked: true }
        }
      }
    });
  }
}

// ================= ADICIONAR / REMOVER / EDITAR =================
function adicionar() {
  const desc = document.getElementById("desc").value;
  const valorInput = document.getElementById("valor").value;
  const cat = document.getElementById("cat").value;
  const origem = document.getElementById("origem")?.value || "Pagamento";
  const mes = document.getElementById("filtroMes").value;

  if (!desc || !valorInput) return;
  const valor = parseFloat(valorInput);

  let novo = { desc, valor, cat };
  if (cat !== "Entrada") novo.origem = origem;

  if (!dados[mes]) dados[mes] = [];
  dados[mes].push(novo);

  localStorage.setItem("dados", JSON.stringify(dados));
  render();

  // Limpa os campos
  document.getElementById("desc").value = "";
  document.getElementById("valor").value = "";
}

function remover(index) {
  const mes = document.getElementById("filtroMes").value;
  dados[mes].splice(index, 1);
  localStorage.setItem("dados", JSON.stringify(dados));
  render();
}

function editarCampo(index, campo, valor) {
  const mes = document.getElementById("filtroMes").value;
  if (campo === "valor") valor = Number(valor);
  dados[mes][index][campo] = valor;
  localStorage.setItem("dados", JSON.stringify(dados));
  render();
}

// ================= RENDERIZAÇÃO DA PÁGINA PRINCIPAL =================
function render() {
  const mesElement = document.getElementById("filtroMes");
  if (!mesElement) return;
  const mes = mesElement.value;

  const lista = document.getElementById("lista");
  const resumo = document.getElementById("resumo");

  if (!dados[mes]) dados[mes] = [];

  let entrada = 0, saida = 0, pagamentoIn = 0, adiantamentoIn = 0;
  let gastos = {
    Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
    Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
  };

  let html = `<div class="card"><h2>${mes}</h2><table id="tabelaDrag">
    <tr><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Origem</th><th></th></tr>`;

  dados[mes].forEach((item, i) => {
    if (item.cat === "Entrada") {
      entrada += item.valor;
      if (item.desc.toLowerCase().includes("pagamento")) pagamentoIn += item.valor;
      if (item.desc.toLowerCase().includes("adiantamento")) adiantamentoIn += item.valor;
    } else {
      saida += item.valor;
      let origem = item.origem || "Pagamento";
      if (gastos[origem]) gastos[origem][item.cat] += item.valor;
    }

    html += `
    <tr draggable="true" data-index="${i}">
      <td><input value="${item.desc}" onchange="editarCampo(${i}, 'desc', this.value)"></td>
      <td><input type="number" value="${item.valor}" onchange="editarCampo(${i}, 'valor', this.value)"></td>
      <td>
        <select onchange="editarCampo(${i}, 'cat', this.value)">
          <option ${item.cat==="Entrada"?"selected":""}>Entrada</option>
          <option ${item.cat==="Necessidades"?"selected":""}>Necessidades</option>
          <option ${item.cat==="Pessoal"?"selected":""}>Pessoal</option>
          <option ${item.cat==="Guardar"?"selected":""}>Guardar</option>
        </select>
      </td>
      <td>
        ${item.cat !== "Entrada" ? `
        <select onchange="editarCampo(${i}, 'origem', this.value)">
          <option ${item.origem==="Pagamento"?"selected":""}>Pagamento</option>
          <option ${item.origem==="Adiantamento"?"selected":""}>Adiantamento</option>
        </select>` : "-"}
      </td>
      <td><button onclick="remover(${i})">❌</button></td>
    </tr>`;
  });

  html += `</table></div>`;
  lista.innerHTML = html;
  ativarDrag();

  // Cálculos de Resumo (Metas 40/30/30)
  const metas = (v) => ({ Necessidades: v * 0.4, Pessoal: v * 0.3, Guardar: v * 0.3 });
  let mPag = metas(pagamentoIn);
  let mAdi = metas(adiantamentoIn);

  resumo.innerHTML = `
  <div class="card">
    <h2>Resumo - ${mes}</h2>
    ${gerarGraficoHTML(pagamentoIn, adiantamentoIn)}
    <div class="resumo-topo">
      <div class="resumo-box"><span>Geral</span><strong id="totalGeral">0</strong></div>
      <div class="resumo-box pagamento-box"><span>Pagamento</span><strong id="vPag">0</strong></div>
      <div class="resumo-box adiantamento-box"><span>Adiantamento</span><strong id="vAdi">0</strong></div>
    </div>
    <div class="resumo-topo" style="margin-top:10px;">
      <div class="resumo-box"><span>Saídas</span><strong id="vSaida">0</strong></div>
      <div class="resumo-box"><span>Saldo</span><strong id="vSaldo">0</strong></div>
    </div>
    <hr>
    <div class="bloco-limite">
      <h3>💰 Do Pagamento</h3>
      ${gerarBarra("Necessidades", gastos.Pagamento.Necessidades, mPag.Necessidades)}
      ${gerarBarra("Pessoal", gastos.Pagamento.Pessoal, mPag.Pessoal)}
      ${gerarBarra("Guardar", gastos.Pagamento.Guardar, mPag.Guardar)}
    </div>
    <div class="bloco-limite">
      <h3>💵 Do Adiantamento</h3>
      ${gerarBarra("Necessidades", gastos.Adiantamento.Necessidades, mAdi.Necessidades)}
      ${gerarBarra("Pessoal", gastos.Adiantamento.Pessoal, mAdi.Pessoal)}
      ${gerarBarra("Guardar", gastos.Adiantamento.Guardar, mAdi.Guardar)}
    </div>
  </div>`;

  // Animação dos valores (com pequeno delay para o HTML carregar)
  setTimeout(() => {
    animarValor("totalGeral", entrada);
    animarValor("vPag", pagamentoIn);
    animarValor("vAdi", adiantamentoIn);
    animarValor("vSaida", saida);
    animarValor("vSaldo", entrada - saida);
  }, 100);
}

// ================= AUXILIARES DE UI PRINCIPAL =================

function gerarBarra(nome, gasto, meta) {
  let diff = meta - gasto;
  let perc = meta ? (gasto / meta) * 100 : 0;
  return `
    <p><strong>${nome}</strong></p>
    <div class="barra-container">
      <div class="barra ${perc<=100?"verde":"vermelho"}" style="width:${Math.min(perc,100)}%">${perc.toFixed(0)}%</div>
    </div>
    <p><small>Meta: R$ ${meta.toFixed(2)} | Resta: R$ ${diff.toFixed(2)}</small></p>
  `;
}

function gerarGraficoHTML(pag, adi) {
  let total = pag + adi;
  let pP = total ? (pag/total)*100 : 0;
  let pA = total ? (adi/total)*100 : 0;
  return `<div class="grafico">
    <div class="barra-grafico pagamento" style="width:${pP}%"></div>
    <div class="barra-grafico adiantamento" style="width:${pA}%"></div>
  </div>`;
}

function animarValor(id, valorFinal) {
  let el = document.getElementById(id);
  if (!el) return;
  
  let atual = 0;
  let incremento = valorFinal / 30; // 30 passos
  if(valorFinal === 0) { el.innerText = "R$ 0"; return; }

  let intervalo = setInterval(() => {
    atual += incremento;
    if (atual >= valorFinal) { 
      atual = valorFinal; 
      clearInterval(intervalo); 
    }
    el.innerText = "R$ " + Math.floor(atual);
  }, 20);
}

function mudarMes(mes){
  const mesFiltroEl = document.getElementById("filtroMes");
  if(mesFiltroEl) mesFiltroEl.value = mes;

  document.querySelectorAll(".mes-btn").forEach(btn => btn.classList.remove("ativo"));
  
  // Encontra e ativa o botão correto
  document.querySelectorAll(".mes-btn").forEach(btn => {
      if(btn.innerText === mes) btn.classList.add("ativo");
  });

  render();
}

function ativarDrag() {
  const tabela = document.getElementById("tabelaDrag");
  if (!tabela) return;
  const linhas = tabela.querySelectorAll("tr[draggable=true]");
  let arrastando;
  
  linhas.forEach(linha => {
    linha.addEventListener("dragstart", () => arrastando = linha);
    linha.addEventListener("dragover", e => { 
        e.preventDefault(); 
        if (arrastando !== linha) linha.parentNode.insertBefore(arrastando, linha); 
    });

    linha.addEventListener("dragend", () => {
        const mes = document.getElementById("filtroMes").value;
        const novasLinhas = tabela.querySelectorAll("tr[draggable=true]");
        let novaLista = [];
        novasLinhas.forEach(l => {
            const indexOriginal = l.dataset.index;
            novaLista.push(dados[mes][indexOriginal]);
        });
        dados[mes] = novaLista;
        
        // Redesenha para atualizar os data-index
        render();
    });
  });
}

// Função para exportar que estava em branco
function exportarExcel() {
    alert("🚀 Função de exportar Excel ainda não implementada, mas o botão funciona!");
}

function toggleDarkMode() {
    const body = document.body;
    const btn = document.getElementById("btnDarkMode");
    
    body.classList.toggle("dark-mode");
    
    // Salva a preferência
    const isDark = body.classList.contains("dark-mode");
    localStorage.setItem("dark-mode", isDark);
    
    // Altera o ícone
    btn.innerText = isDark ? "☀️" : "🌙";
}

// Carregar preferência ao abrir o site
window.addEventListener("load", () => {
    if (localStorage.getItem("dark-mode") === "true") {
        document.body.classList.add("dark-mode");
        document.getElementById("btnDarkMode").innerText = "☀️";
    }
});

// ================= INICIALIZAÇÃO =================
// carregarDadosDoBanco já é chamado pelo body onload no HTML
