// ================= CONFIGURAÇÃO DO GITHUB =================
const USUARIO_GITHUB = "MateusFSR"; 
const REPO_GITHUB = "Contas";
const TOKEN_GITHUB = "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";
const ARQUIVO_DADOS = "dados.json";

// ================= DADOS INICIAIS =================
let dadosPadrao = {
  Julho: [
    { desc: "Pagamento", valor: 1800, cat: "Entrada" },
    { desc: "Adiantamento", valor: 1200, cat: "Entrada" }
  ]
};

let dados = JSON.parse(localStorage.getItem("dados")) || dadosPadrao;

// ================= FUNÇÕES DE SINCRONIZAÇÃO (GITHUB) =================

async function carregarDadosDoGitHub() {
  console.log("Buscando dados no GitHub...");
  const url = `https://api.github.com/repos/${USUARIO_GITHUB}/${REPO_GITHUB}/contents/${ARQUIVO_DADOS}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `token ${TOKEN_GITHUB}` }
    });

    if (res.ok) {
      const json = await res.json();
      // Decodifica de Base64 para JSON (suportando acentos)
      const conteudoDecodificado = decodeURIComponent(escape(atob(json.content)));
      dados = JSON.parse(conteudoDecodificado);
      console.log("✅ Dados sincronizados do GitHub com sucesso.");
    } else {
      console.warn("⚠️ Arquivo não encontrado no repositório. Usando dados locais.");
    }
  } catch (erro) {
    console.error("Erro ao conectar com GitHub:", erro);
  }
  render();
}

async function salvarNoGitHub() {
  const btn = document.getElementById("btnSalvar");
  if (btn) {
    btn.innerText = "⏳ Salvando...";
    btn.disabled = true;
  }

  const url = `https://api.github.com/repos/${USUARIO_GITHUB}/${REPO_GITHUB}/contents/${ARQUIVO_DADOS}`;

  try {
    // 1. Tentar pegar o SHA do arquivo existente
    let sha = "";
    const resGet = await fetch(url, {
      headers: { 'Authorization': `token ${TOKEN_GITHUB}` }
    });
    
    if (resGet.ok) {
      const dataGet = await resGet.json();
      sha = dataGet.sha;
    }

    // 2. Preparar o conteúdo em Base64
    const conteudoJSON = JSON.stringify(dados, null, 2);
    const conteudoBase64 = btoa(unescape(encodeURIComponent(conteudoJSON)));

    // 3. Enviar atualização (PUT)
    const resPut = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN_GITHUB}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "Sincronização manual via WebApp",
        content: conteudoBase64,
        sha: sha
      })
    });

    if (resPut.ok) {
      alert("✅ Dados salvos no GitHub!");
      localStorage.setItem("dados", JSON.stringify(dados));
    } else {
      const erroMsg = await resPut.json();
      alert("❌ Erro ao salvar: " + erroMsg.message);
    }
  } catch (erro) {
    console.error("Erro de conexão:", erro);
    alert("❌ Erro ao conectar ao GitHub.");
  } finally {
    if (btn) {
      btn.innerText = "☁️ Salvar no GitHub";
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

// ================= GRÁFICO (CHART) =================
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

// ================= RENDERIZAÇÃO =================
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

  // Metas e Resumo
  const calcMetas = (v) => ({ Necessidades: v * 0.4, Pessoal: v * 0.3, Guardar: v * 0.3 });
  let metaPag = calcMetas(pagamento);
  let metaAdi = calcMetas(adiantamento);

  resumo.innerHTML = `
  <div class="card">
    <h2>Resumo - ${mes}</h2>
    ${gerarGraficoTopoHTML(pagamento, adiantamento)}
    <div class="resumo-topo">
      <div class="resumo-box"><span>Total Geral</span><strong id="totalGeral">R$ 0</strong></div>
      <div class="resumo-box pagamento-box"><span>Pagamento</span><strong id="valorPagamento">R$ 0</strong></div>
      <div class="resumo-box adiantamento-box"><span>Adiantamento</span><strong id="valorAdiantamento">R$ 0</strong></div>
    </div>
    <div class="resumo-topo" style="margin-top:10px;">
      <div class="resumo-box"><span>Saídas</span><strong id="valorSaida">R$ 0</strong></div>
      <div class="resumo-box"><span>Saldo</span><strong id="valorSaldo">R$ 0</strong></div>
    </div>
    <hr>
    <div class="bloco-limite">
      <h3>💰 Pagamento</h3>
      ${gerarBarraProgresso("Necessidades", gastos.Pagamento.Necessidades, metaPag.Necessidades)}
      ${gerarBarraProgresso("Pessoal", gastos.Pagamento.Pessoal, metaPag.Pessoal)}
      ${gerarBarraProgresso("Guardar", gastos.Pagamento.Guardar, metaPag.Guardar)}
    </div>
    <div class="bloco-limite">
      <h3>💵 Adiantamento</h3>
      ${gerarBarraProgresso("Necessidades", gastos.Adiantamento.Necessidades, metaAdi.Necessidades)}
      ${gerarBarraProgresso("Pessoal", gastos.Adiantamento.Pessoal, metaAdi.Pessoal)}
      ${gerarBarraProgresso("Guardar", gastos.Adiantamento.Guardar, metaAdi.Guardar)}
    </div>
  </div>`;

  renderGrafico(gastos);
  setTimeout(() => {
    animarValor("totalGeral", entrada);
    animarValor("valorPagamento", pagamento);
    animarValor("valorAdiantamento", adiantamento);
    animarValor("valorSaida", saida);
    animarValor("valorSaldo", entrada - saida);
  }, 100);
}

// ================= AUXILIARES DE INTERFACE =================

function gerarBarraProgresso(nome, gasto, meta) {
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

function gerarGraficoTopoHTML(pag, adi) {
  let total = pag + adi;
  let pP = total ? (pag/total)*100 : 0;
  let pA = total ? (adi/total)*100 : 0;
  return `<div class="grafico">
    <div class="barra-grafico pagamento" style="width:${pP}%">${pP.toFixed(0)}%</div>
    <div class="barra-grafico adiantamento" style="width:${pA}%">${pA.toFixed(0)}%</div>
  </div>`;
}

function animarValor(id, valorFinal) {
  let atual = 0;
  let incremento = valorFinal / 30;
  let intervalo = setInterval(() => {
    atual += incremento;
    if (atual >= valorFinal) { atual = valorFinal; clearInterval(intervalo); }
    let el = document.getElementById(id);
    if (el) el.innerText = "R$ " + atual.toFixed(0);
  }, 20);
}

function mudarMes(mes){
  const el = document.getElementById("filtroMes");
  if(el) el.value = mes;
  document.querySelectorAll(".mes-btn").forEach(btn => btn.classList.remove("ativo"));
  if(event) event.target.classList.add("ativo");
  render();
}

function ativarDrag() {
  const linhas = document.querySelectorAll("#tabelaDrag tr[draggable=true]");
  let arrastando;
  linhas.forEach(linha => {
    linha.addEventListener("dragstart", () => arrastando = linha);
    linha.addEventListener("dragover", e => {
      e.preventDefault();
      if (arrastando !== linha) linha.parentNode.insertBefore(arrastando, linha);
    });
    linha.addEventListener("dragend", () => {
        const mes = document.getElementById("filtroMes").value;
        const novasLinhas = document.querySelectorAll("#tabelaDrag tr[draggable=true]");
        let novaLista = [];
        novasLinhas.forEach(l => novaLista.push(dados[mes][l.dataset.index]));
        dados[mes] = novaLista;
        localStorage.setItem("dados", JSON.stringify(dados));
        render();
    });
  });
}

// ================= INICIALIZAÇÃO =================
window.onload = carregarDadosDoGitHub;
