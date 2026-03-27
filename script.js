// LOGIN FIXO
function login() {
  const user = document.getElementById("usuario").value;
  const pass = document.getElementById("senha").value;

  if (user === "MateusFSR" && pass === "mateus21") {
    window.location.href = "dashboard.html";
  } else {
    document.getElementById("erro").innerText = "Login inválido!";
  }
}

// DADOS DAS PLANILHAS (simplificado - depois posso deixar completo)
const contas = {
  sem1: [
    ["Descrição", "Valor"],
    ["Exemplo Conta 1", "100"],
    ["Exemplo Conta 2", "200"]
  ],
  sem2: [
    ["Descrição", "Valor"],
    ["Exemplo Conta A", "150"],
    ["Exemplo Conta B", "300"]
  ]
};

// MOSTRAR TABELA
function mostrarTabela(semestre) {
  const tabela = document.getElementById("tabela");
  tabela.innerHTML = "";

  contas[semestre].forEach((linha, index) => {
    let tr = "<tr>";
    linha.forEach(col => {
      tr += index === 0 ? `<th>${col}</th>` : `<td>${col}</td>`;
    });
    tr += "</tr>";
    tabela.innerHTML += tr;
  });
}
