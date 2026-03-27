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

let dados = dadosPadrao;

// ================= FUNÇÕES DE PERSISTÊNCIA (GITHUB API) =================

async function carregarDadosDoGitHub() {
  const url = `https://api.github.com/repos/${USUARIO_GITHUB}/${REPO_GITHUB}/contents/${ARQUIVO_DADOS}`;
  
  try {
    const res = await fetch(url, {
      headers: { 'Authorization': `token ${TOKEN_GITHUB}` }
    });

    if (res.ok) {
      const json = await res.json();
      // Decodifica de Base64 para JSON
      const conteudoDecodificado = decodeURIComponent(escape(atob(json.content)));
      dados = JSON.parse(conteudoDecodificado);
      console.log("✅ Dados sincronizados do GitHub.");
    } else {
      console.warn("⚠️ Arquivo não encontrado no GitHub. Usando dados locais/padrão.");
      const local = localStorage.getItem("dados");
      if (local) dados = JSON.parse(local);
    }
  } catch (erro) {
    console.error("Erro ao conectar com GitHub:", erro);
  }
  render();
}

async function salvar() {
  // Salva no LocalStorage (Backup imediato)
  localStorage.setItem("dados", JSON.stringify(dados));

  const url = `https://api.github.com/repos/${USUARIO_GITHUB}/${REPO_GITHUB}/contents/${ARQUIVO_DADOS}`;

  try {
    // 1. Pega o SHA (identificador da versão atual)
    const resGet = await fetch(url, {
      headers: { 'Authorization': `token ${TOKEN_GITHUB}` }
    });
    
    let sha = "";
    if (resGet.ok) {
      const dataGet = await resGet.json();
      sha = dataGet.sha;
    }

    // 2. Prepara o conteúdo
    const conteudoJSON = JSON.stringify(dados, null, 2);
    const conteudoBase64 = btoa(unescape(encodeURIComponent(conteudoJSON)));

    // 3. Faz o "Upload" (PUT)
    const resPut = await fetch(url, {
      method: 'PUT',
      headers: {
        'Authorization': `token ${TOKEN_GITHUB}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: "📊 Atualização de dados via WebApp",
        content: conteudoBase64,
        sha: sha
      })
    });

    if (resPut.ok) console.log("☁️ Salvo no GitHub!");
  } catch (erro) {
    console.error("Erro ao salvar no GitHub:", erro);
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

// ================= ADICIONAR =================
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

  salvar(); // Salva no GitHub
  render();
}

// ================= REMOVER =================
function remover(index) {
  const mes = document.getElementById("filtroMes").value;
  dados[mes].splice(index, 1);
  salvar(); // Salva no GitHub
  render();
}

// ================= EDITAR =================
function editarCampo(index, campo, valor) {
  const mes = document.getElementById("filtroMes").value;
  if (campo === "valor") valor = Number(valor);
  dados[mes][index][campo] = valor;
  salvar(); // Salva no GitHub
  render();
}

// ================= RENDERIZAÇÃO PRINCIPAL =================
function render() {
  const mesElement = document.getElementById("filtroMes");
  if(!mesElement) return;
  
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
      if(gastos[origem]) gastos[origem][item.cat] += item.valor;
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

  // Cálculos de Metas e Resumo
  const metas = (v) => ({ Necessidades: v * 0.4, Pessoal: v * 0.3, Guardar: v * 0.3 });
  let metaPag = metas(pagamento);
  let metaAdi = metas(adiantamento);

  resumo.innerHTML = `
  <div class="card">
    <h2>Resumo - ${mes}</h2>
    ${gerarGraficoHTML(pagamento, adiantamento)}
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
      ${gerarBarraMeta("Necessidades", gastos.Pagamento.Necessidades, metaPag.Necessidades)}
      ${gerarBarraMeta("Pessoal", gastos.Pagamento.Pessoal, metaPag.Pessoal)}
      ${gerarBarraMeta("Guardar", gastos.Pagamento.Guardar, metaPag.Guardar)}
    </div>
    <div class="bloco-limite">
      <h3>💵 Adiantamento</h3>
      ${gerarBarraMeta("Necessidades", gastos.Adiantamento.Necessidades, metaAdi.Necessidades)}
      ${gerarBarraMeta("Pessoal", gastos.Adiantamento.Pessoal, metaAdi.Pessoal)}
      ${gerarBarraMeta("Guardar", gastos.Adiantamento.Guardar, metaAdi.Guardar)}
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

// ================= FUNÇÕES AUXILIARES DE UI =================

function gerarBarraMeta(nome, gasto, meta) {
  let diff = meta - gasto;
  let perc = meta ? (gasto / meta) * 100 : 0;
  return `
    <p><strong>${nome}</strong></p>
    <p>Meta: R$ ${meta.toFixed(2)} | Gasto: R$ ${gasto}</p>
    <div class="barra-container">
      <div class="barra ${perc<=100?"verde":"vermelho"}" style="width:${Math.min(perc,100)}%">
        ${perc.toFixed(0)}%
      </div>
    </div>
    <p>${diff >= 0 ? "🟢 Pode gastar R$ " + diff.toFixed(2) : "🔴 Excedeu R$ " + Math.abs(diff).toFixed(2)}</p>
  `;
}

function gerarGraficoHTML(pag, adi) {
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
  document.getElementById("filtroMes").value = mes;
  document.querySelectorAll(".mes-btn").forEach(btn => btn.classList.remove("ativo"));
  event.target.classList.add("ativo");
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
        salvar();
        render();
    });
  });
}

// ================= INICIALIZAÇÃO =================
window.onload = carregarDadosDoGitHub;
