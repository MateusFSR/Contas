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
        legend: {
          labels: { color: '#fff' }
        }
      }
    }
  });
}

// ================= DADOS =================
let dadosPadrao = {
  Julho: [
    { desc: "Pagamento", valor: 1800, cat: "Entrada" },
    { desc: "Adiantamento", valor: 1200, cat: "Entrada" }
  ]
};

let dados = JSON.parse(localStorage.getItem("dados")) || dadosPadrao;

// ================= ADICIONAR =================
function adicionar() {
  const desc = document.getElementById("desc").value;
  const valor = parseFloat(document.getElementById("valor").value);
  const cat = document.getElementById("cat").value;
  const origem = document.getElementById("origem")?.value || "Pagamento";
  const mes = document.getElementById("filtroMes").value;

  if (!desc || !valor) return;

  let novo = { desc, valor, cat };

  if (cat !== "Entrada") {
    novo.origem = origem;
  }

  if (!dados[mes]) dados[mes] = [];

  dados[mes].push(novo);

  salvar();
  render();
}

// ================= REMOVER =================
function remover(index) {
  const mes = document.getElementById("filtroMes").value;
  dados[mes].splice(index, 1);
  salvar();
  render();
}

// ================= SALVAR =================
function salvar() {
  localStorage.setItem("dados", JSON.stringify(dados));
}

// ================= RENDER =================
function render() {
  const mes = document.getElementById("filtroMes").value;
  const lista = document.getElementById("lista");
  const resumo = document.getElementById("resumo");

  if (!dados[mes]) dados[mes] = [];

  let entrada = 0;
  let saida = 0;

  let pagamento = 0;
  let adiantamento = 0;

  let gastos = {
    Pagamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 },
    Adiantamento: { Necessidades: 0, Pessoal: 0, Guardar: 0 }
  };

  let html = `
  <div class="card">
    <h2>${mes}</h2>
    <table id="tabelaDrag">
    <tr>
      <th>Descrição</th>
      <th>Valor</th>
      <th>Categoria</th>
      <th>Origem</th>
      <th></th>
    </tr>`;

  dados[mes].forEach((item, i) => {

    if (item.cat === "Entrada") {
      entrada += item.valor;

      if (item.desc.toLowerCase().includes("pagamento")) pagamento += item.valor;
      if (item.desc.toLowerCase().includes("adiantamento")) adiantamento += item.valor;

    } else {
      saida += item.valor;

      let origem = item.origem || "Pagamento";
      gastos[origem][item.cat] += item.valor;
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

  // ===== METAS =====
  function metas(valor) {
    return {
      Necessidades: valor * 0.4,
      Pessoal: valor * 0.3,
      Guardar: valor * 0.3
    };
  }

  let metaPag = metas(pagamento);
  let metaAdi = metas(adiantamento);

  // ===== RESUMO =====
  resumo.innerHTML = `
  <div class="card">

    <h2>Resumo - ${mes}</h2>

    ${gerarGrafico(pagamento, adiantamento)}

    <div class="resumo-topo">
      <div class="resumo-box">
        <span>Total Geral</span>
        <strong id="totalGeral">R$ 0</strong>
      </div>

      <div class="resumo-box pagamento-box">
        <span>Pagamento</span>
        <strong id="valorPagamento">R$ 0</strong>
      </div>

      <div class="resumo-box adiantamento-box">
        <span>Adiantamento</span>
        <strong id="valorAdiantamento">R$ 0</strong>
      </div>
    </div>

    <div class="resumo-topo" style="margin-top:10px;">
      <div class="resumo-box">
        <span>Saídas</span>
        <strong id="valorSaida">R$ 0</strong>
      </div>

      <div class="resumo-box">
        <span>Saldo</span>
        <strong id="valorSaldo">R$ 0</strong>
      </div>
    </div>

    <hr>

    <div class="bloco-limite">
      <h3>💰 Pagamento</h3>
      ${gerar("Necessidades", gastos.Pagamento.Necessidades, metaPag.Necessidades)}
      ${gerar("Pessoal", gastos.Pagamento.Pessoal, metaPag.Pessoal)}
      ${gerar("Guardar", gastos.Pagamento.Guardar, metaPag.Guardar)}
    </div>

    <div class="bloco-limite">
      <h3>💵 Adiantamento</h3>
      ${gerar("Necessidades", gastos.Adiantamento.Necessidades, metaAdi.Necessidades)}
      ${gerar("Pessoal", gastos.Adiantamento.Pessoal, metaAdi.Pessoal)}
      ${gerar("Guardar", gastos.Adiantamento.Guardar, metaAdi.Guardar)}
    </div>

  </div>
  `;

  renderGrafico(gastos);

  setTimeout(() => {
    animarValor("totalGeral", entrada);
    animarValor("valorPagamento", pagamento);
    animarValor("valorAdiantamento", adiantamento);
    animarValor("valorSaida", saida);
    animarValor("valorSaldo", entrada - saida);
  }, 100);
}

// ================= EXPORTAR =================
function exportarExcel() {
  const mes = document.getElementById("filtroMes").value;
  const dadosMes = dados[mes] || [];

  let csv = "Descrição,Valor,Categoria,Origem\n";

  dadosMes.forEach(i => {
    csv += `${i.desc},${i.valor},${i.cat},${i.origem || "-"}\n`;
  });

  let blob = new Blob([csv]);
  let a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = mes + ".csv";
  a.click();
}

// ================= RESTO =================
function editarCampo(index, campo, valor) {
  const mes = document.getElementById("filtroMes").value;
  if (campo === "valor") valor = Number(valor);
  dados[mes][index][campo] = valor;
  salvar();
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
    linha.addEventListener("dragend", atualizarOrdem);
  });
}

function atualizarOrdem() {
  const mes = document.getElementById("filtroMes").value;
  const linhas = document.querySelectorAll("#tabelaDrag tr[draggable=true]");

  let nova = [];
  linhas.forEach(l => nova.push(dados[mes][l.dataset.index]));

  dados[mes] = nova;
  salvar();
  render();
}

function gerar(nome, gasto, meta) {
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

function animarValor(id, valorFinal) {
  let atual = 0;
  let incremento = valorFinal / 30;

  let intervalo = setInterval(() => {
    atual += incremento;

    if (atual >= valorFinal) {
      atual = valorFinal;
      clearInterval(intervalo);
    }

    let el = document.getElementById(id);
    if (el) el.innerText = "R$ " + atual.toFixed(0);
  }, 20);
}

function gerarGrafico(pagamento, adiantamento) {
  let total = pagamento + adiantamento;

  let percPag = total ? (pagamento / total) * 100 : 0;
  let percAdi = total ? (adiantamento / total) * 100 : 0;

  return `
    <div class="grafico">
      <div class="barra-grafico pagamento" style="width:${percPag}%">
        ${percPag.toFixed(0)}%
      </div>
      <div class="barra-grafico adiantamento" style="width:${percAdi}%">
        ${percAdi.toFixed(0)}%
      </div>
    </div>
  `;
}
