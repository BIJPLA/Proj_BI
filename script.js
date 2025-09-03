const URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJKMi1lL6q1brQg2E8CN11-mNtMfdlM9AocetE3NrWbjJhG2uyTdclMXTbOu7Nq7hWtAWcKd31cwTr/pub?output=csv";

function login() {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value.trim();

  fetch(URL)
    .then(response => {
      if (!response.ok) throw new Error("Erro ao carregar planilha.");
      return response.text();
    })
    .then(csv => {
      const linhas = csv.split(/\r?\n/).map(l => l.split(','));
      const [header, ...rows] = linhas;

      const emailIdx = header.findIndex(h => h.trim().toLowerCase() === "e-mail");
      const senhaIdx = header.findIndex(h => h.trim().toLowerCase() === "senha");

      if (emailIdx === -1 || senhaIdx === -1) {
        document.getElementById("error-msg").innerText = "Cabeçalhos ausentes na planilha.";
        return;
      }

      const usuario = rows.find(l => l[emailIdx]?.trim() === email && l[senhaIdx]?.trim() === senha);
      if (usuario) {
        sessionStorage.setItem("logado", "true");
        window.location.href = "dashboard.html";
      } else {
        document.getElementById("error-msg").innerText = "Usuário ou senha inválidos.";
      }
    })
    .catch(err => {
      document.getElementById("error-msg").innerText = "Erro ao validar login.";
    });
}