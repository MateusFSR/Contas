// LOGIN
function login() {
  const user = document.getElementById("usuario").value;
  const pass = document.getElementById("senha").value;

  if (user === "MateusFSR" && pass === "mateus21") {
    window.location.href = "dashboard.html";
  } else {
    document.getElementById("erro").innerText = "Login inválido!";
  }
}

// ===== DADOS 100% CONVERTIDOS =====

const dados = {
  1: {
    Janeiro: [
      { desc: "Pagamento", valor: 2100, cat: "Entrada" },
      { desc: "Extra", valor: 0, cat: "Entrada" },
      { desc: "Água e Luz", valor: 385, cat: "Necessidades" },
      { desc: "Acordo Dívidas", valor: 100, cat: "Necessidades" },
    ],
  },

  2: {
    Julho: [
      { desc: "Salário", valor: 2100, cat: "Entrada" },
      { desc: "Adiantamento", valor: 840, cat: "Entrada" },
      { desc: "Pagamento", valor: 1260, cat: "Entrada" },
    ],
  }
};

// TROCAR SEMESTRE
function trocarSemestre(sem) {
  const container = document.getElementById("meses");
  const resumo = document.getElementById("resumo");

  container.innerHTML = "";
  resumo.innerHTML = "";

  let totalGeral = 0;
  let totalEntrada = 0;
  let totalSaida = 0;

  Object.keys(dados[sem]).forEach(mes => {
    const lista = dados[sem][mes];

    let totalMes = 0;

    let html = `<div class="card">
      <h2>${mes}</h2>
      <table>
      <tr><th>Descrição</th><th>Valor</th><th>Categoria</th></tr>`;

    lista.forEach(item => {
      totalMes += item.valor;

      if (item.cat === "Entrada") {
        totalEntrada += item.valor;
      } else {
        totalSaida += item.valor;
      }

      html += `
        <tr>
          <td>${item.desc}</td>
          <td>R$ ${item.valor}</td>
          <td>${item.cat}</td>
        </tr>
      `;
    });

    html += `</table>
      <div class="total">Total do mês: R$ ${totalMes}</div>
    </div>`;

    totalGeral += totalMes;
    container.innerHTML += html;
  });

  resumo.innerHTML = `
    <h2>Total do semestre: R$ ${totalGeral}</h2>
    <p>💰 Entradas: R$ ${totalEntrada}</p>
    <p>💸 Saídas: R$ ${totalSaida}</p>
    <p>📊 Saldo: R$ ${totalEntrada - totalSaida}</p>
  `;
}
