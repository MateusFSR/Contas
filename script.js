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

// ================= SINCRONIZAÇÃO COM O BANCO (SUPABASE) =================

async function carregarDadosDoBanco() {
  console.log("Conectando ao banco de dados...");


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
    btn.innerText = "⏳ Salvando...";
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
      alert("✅ Sincronizado com o Banco de Dados!");


















      localStorage.setItem("dados", JSON.stringify(dados));
    } else {
      alert("❌ Erro ao salvar no banco.");

    }
  } catch (erro) {
    console.error(erro);
    alert("❌ Falha na comunicação com o servidor.");
  } finally {
    if (btn) {
      btn.innerText = "☁️ Salvar no Banco";
      btn.disabled = false;
    }
  }
}

// ================= LOGIN =================
function login() {
  const user = document.getElementById("usuario").value;
  const pass = document.getElementById("senha").value;

  if (user === "MateusFSR" && pass === "mateus21") {
    window.location.href = "dashboard.html";
  } else {
    document.getElementById("erro").innerText = "Login inválido!";
  }
}

// ================= GRÁFICO (CHART JS) =================
let grafico;

function renderGrafico(gastos) {
  const ctx = document.getElementById('graficoCategorias');
  if (!ctx) return;

  const dadosGrafico = [
    gastos.Pagamento.Necessidades + gastos.Adiantamento.Necessidades,
    gastos.Pagamento.Pessoal + gastos.Adiantamento.Pessoal,
    gastos.Pagamento.Guardar + gastos.Adiantamento.Guardar
  ];

  if (grafico) grafico.destroy();

  grafico = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Necessidades', 'Pessoal', 'Guardar'],
      datasets: [{
        data: dadosGrafico,
        backgroundColor: ['#22c55e', '#3b82f6', '#f59e0b']
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: '#fff' } }
      }
    }
  });
}

// ================= ADICIONAR / REMOVER / EDITAR =================
function adicionar() {
  const desc = document.getElementById("desc").value;
  const valor = parseFloat(document.getElementById("valor").value);
  const cat = document.getElementById("cat").value;
  const origem = document.getElementById("origem")?.value || "Pagamento";
  const mes = document.getElementById("filtroMes").value;

  if (!desc || !valor) return;

  let novo = { desc, valor, cat };
  if (cat !== "Entrada") novo.origem = origem;

  if (!dados[mes]) dados[mes] = [];
  dados[mes].push(novo);

  localStorage.setItem("dados", JSON.stringify(dados));
  render();
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

// ================= RENDERIZAÇÃO DA PÁGINA =================
function render() {
  const mesElement = document.getElementById("filtroMes");
  if (!mesElement) return;
  const mes = mesElement.value;

  const lista = document.getElementById("lista");
  const resumo = document.getElementById("resumo");

  if (!dados[mes]) dados[mes] = [];

  let entrada = 0, saida = 0, pagamento = 0, adiantamento = 0;
  let gastos = {
    Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
    Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
  };

  let html = `<div class="card"><h2>${mes}</h2><table id="tabelaDrag">
    <tr><th>Descrição</th><th>Valor</th><th>Categoria</th><th>Origem</th><th></th></tr>`;

  dados[mes].forEach((item, i) => {
    if (item.cat === "Entrada") {
      entrada += item.valor;
      if (item.desc.toLowerCase().includes("pagamento")) pagamento += item.valor;
      if (item.desc.toLowerCase().includes("adiantamento")) adiantamento += item.valor;
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

  // Cálculos de Resumo
  const metas = (v) => ({ Necessidades: v * 0.4, Pessoal: v * 0.3, Guardar: v * 0.3 });
  let mPag = metas(pagamento);
  let mAdi = metas(adiantamento);

  resumo.innerHTML = `
  <div class="card">
    <h2>Resumo - ${mes}</h2>
    ${gerarGraficoHTML(pagamento, adiantamento)}
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
      <h3>💰 Pagamento</h3>
      ${gerarBarra("Necessidades", gastos.Pagamento.Necessidades, mPag.Necessidades)}
      ${gerarBarra("Pessoal", gastos.Pagamento.Pessoal, mPag.Pessoal)}
      ${gerarBarra("Guardar", gastos.Pagamento.Guardar, mPag.Guardar)}
    </div>
    <div class="bloco-limite">
      <h3>💵 Adiantamento</h3>
      ${gerarBarra("Necessidades", gastos.Adiantamento.Necessidades, mAdi.Necessidades)}
      ${gerarBarra("Pessoal", gastos.Adiantamento.Pessoal, mAdi.Pessoal)}
      ${gerarBarra("Guardar", gastos.Adiantamento.Guardar, mAdi.Guardar)}
    </div>
  </div>`;

  renderGrafico(gastos);
  setTimeout(() => {
    animarValor("totalGeral", entrada);
    animarValor("vPag", pagamento);
    animarValor("vAdi", adiantamento);
    animarValor("vSaida", saida);
    animarValor("vSaldo", entrada - saida);
  }, 100);
}

// ================= AUXILIARES DE UI =================

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
  let atual = 0;
  let incremento = valorFinal / 30;
  let intervalo = setInterval(() => {
    atual += incremento;
    if (atual >= valorFinal) { atual = valorFinal; clearInterval(intervalo); }
    let el = document.getElementById(id);
    if (el) el.innerText = "R$ " + Math.floor(atual);
  }, 20);
}

function mudarMes(mes){
  document.getElementById("filtroMes").value = mes;

  document.querySelectorAll(".mes-btn").forEach(btn => btn.classList.remove("ativo"));
  if(event) event.target.classList.add("ativo");
  render();
}

function ativarDrag() {
  const linhas = document.querySelectorAll("#tabelaDrag tr[draggable=true]");
  let arrastando;
  linhas.forEach(linha => {
    linha.addEventListener("dragstart", () => arrastando = linha);
    linha.addEventListener("dragover", e => { e.preventDefault(); if (arrastando !== linha) linha.parentNode.insertBefore(arrastando, linha); });



    linha.addEventListener("dragend", () => {
        const mes = document.getElementById("filtroMes").value;
        const novasLinhas = document.querySelectorAll("#tabelaDrag tr[draggable=true]");
        let novaLista = [];
        novasLinhas.forEach(l => novaLista.push(dados[mes][l.dataset.index]));
        dados[mes] = novaLista;

        render();
    });
  });
}

// ================= INICIALIZAÇÃO =================
window.onload = carregarDadosDoBanco;
