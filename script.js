const URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJKMi1lL6q1brQg2E8CN11-mNtMfdlM9AocetE3NrWbjJhG2uyTdclMXTbOu7Nq7hWtAWcKd31cwTr/pub?output=csv";


async function login() {
  const email = document.getElementById('email').value.trim();
  const senha = document.getElementById('senha').value.trim();
  const errorEl = document.getElementById("error-msg");
  const loginScreen = document.getElementById("login-screen");
  const dashScreen = document.getElementById("dashboard-screen");
  const ld = document.getElementById("loading-screen");

  if (errorEl) errorEl.innerText = "";

  try {
    if (ld) ld.style.display = "flex";

    const response = await fetch(URL);
    if (!response.ok) throw new Error("Erro ao carregar planilha.");
    const csv = await response.text();

    const linhas = csv.split(/\r?\n/).map(l => l.split(','));
    const [header, ...rows] = linhas;

    const emailIdx = header.findIndex(h => h.trim().toLowerCase() === "e-mail");
    const senhaIdx = header.findIndex(h => h.trim().toLowerCase() === "senha");

    if (emailIdx === -1 || senhaIdx === -1) {
      if (errorEl) errorEl.innerText = "Cabeçalhos ausentes na planilha.";
      return;
    }

    const usuario = rows.find(l => (l[emailIdx] || "").trim() === email && (l[senhaIdx] || "").trim() === senha);
    if (!usuario) {
      if (errorEl) errorEl.innerText = "Usuário ou senha inválidos.";
      return;
    }

    // Login básico OK, agora valida permissão
    sessionStorage.setItem("logado", "true");
    sessionStorage.setItem("email", email);

    if (typeof window._carregarPermissoesUsuario === "function") {
      const perms = await window._carregarPermissoesUsuario(email);

      if (!perms || !Object.keys(perms).length) {
        // Strict mode: sem permissão, sem dashboard
        sessionStorage.removeItem("logado");
        sessionStorage.removeItem("email");
        if (errorEl) errorEl.innerText = "Você não tem permissão para acessar nenhum dashboard.";
        return;
      }

      window.permissoesAtuais = perms;

      if (typeof window._montarDepartamentosDashboard === "function") {
        window._montarDepartamentosDashboard();
      }
    }

    if (loginScreen && dashScreen) {
      loginScreen.style.display = "none";
      dashScreen.style.display = "flex";
    }

  } catch (err) {
    console.error(err);
    if (errorEl) errorEl.innerText = "Erro ao validar login.";
  } finally {
    if (ld) ld.style.display = "none";
  }
}


document.addEventListener("DOMContentLoaded", async function () {
  const loginScreen = document.getElementById("login-screen");
  const dashScreen = document.getElementById("dashboard-screen");
  const ld = document.getElementById("loading-screen");
  const errorEl = document.getElementById("error-msg");

  const logado = sessionStorage.getItem("logado") === "true";
  const email = sessionStorage.getItem("email");

  // Se não estiver logado, garante que só a tela de login aparece
  if (!logado || !email) {
    if (loginScreen) loginScreen.style.display = "flex";
    if (dashScreen) dashScreen.style.display = "none";
    if (ld) ld.style.display = "none";
    return;
  }

  // Já logado: validar permissões antes de mostrar qualquer dashboard
  try {
    if (ld) ld.style.display = "flex";

    if (typeof window._carregarPermissoesUsuario === "function") {
      const perms = await window._carregarPermissoesUsuario(email);

      if (!perms || !Object.keys(perms).length) {
        sessionStorage.removeItem("logado");
        sessionStorage.removeItem("email");
        if (loginScreen && dashScreen) {
          loginScreen.style.display = "flex";
          dashScreen.style.display = "none";
        }
        if (errorEl) errorEl.innerText = "Você não tem permissão para acessar nenhum dashboard.";
        return;
      }

      window.permissoesAtuais = perms;

      if (typeof window._montarDepartamentosDashboard === "function") {
        window._montarDepartamentosDashboard();
      }

      if (loginScreen && dashScreen) {
        loginScreen.style.display = "none";
        dashScreen.style.display = "flex";
      }
    }
  } catch (err) {
    console.error(err);
    sessionStorage.removeItem("logado");
    sessionStorage.removeItem("email");
    if (loginScreen && dashScreen) {
      loginScreen.style.display = "flex";
      dashScreen.style.display = "none";
    }
    if (errorEl) errorEl.innerText = "Erro ao validar permissões.";
  } finally {
    if (ld) ld.style.display = "none";
  }
});
