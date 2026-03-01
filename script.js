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

    const emailIdx = header.findIndex(h => h.trim().toLowerCase() === "e-mail" || h.trim().toLowerCase() === "email");
    const senhaIdx = header.findIndex(h => h.trim().toLowerCase() === "senha");
    const nomeIdx  = header.findIndex(h => ["nome","usuário","usuario","colaborador"].includes(h.trim().toLowerCase()));
    const cargoIdx = header.findIndex(h => ["cargo","função","funcao"].includes(h.trim().toLowerCase()));
    const permIdx  = header.findIndex(h => ["permissões","permissoes","permissão","permissao"].includes(h.trim().toLowerCase()));

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

    // Perfil (Nome/Cargo/Permissões) vindo da própria planilha de login, se existir
    try{
      const nome = nomeIdx >= 0 ? (usuario[nomeIdx] || "").trim() : "";
      const cargo = cargoIdx >= 0 ? (usuario[cargoIdx] || "").trim() : "";
      const permRaw = permIdx >= 0 ? (usuario[permIdx] || "").trim() : "";
      if (nome) sessionStorage.setItem('user_nome', nome);
      if (cargo) sessionStorage.setItem('user_cargo', cargo);
      if (permRaw) sessionStorage.setItem('user_permraw', permRaw);
    }catch(e){}

    // UI: usuário no menu
    try { await _hydrateUserProfile(email); } catch(e) {}
    try { _syncUserUi(email); } catch(e) {}

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

    try { _renderWelcome(); } catch(e) {}

    // UI: side menu toggle
    try { _bindSidebarToggle(); } catch(e) {}

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

    // garante Nome/Cargo/Permissões no menu
    try { await _hydrateUserProfile(email); } catch(e) {}

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

      // UI: usuário no menu
      try { _syncUserUi(email); } catch(e) {}

      if (typeof window._montarDepartamentosDashboard === "function") {
        window._montarDepartamentosDashboard();
      }

      if (loginScreen && dashScreen) {
        loginScreen.style.display = "none";
        dashScreen.style.display = "flex";
      }

      try { _renderWelcome(); } catch(e) {}

      // UI: side menu toggle
      try { _bindSidebarToggle(); } catch(e) {}
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


// =============================
// UI helpers (não mexe em regra de login/permissão)
// =============================

function _syncUserUi(email){
  const elName = document.getElementById('userName');
  const elRole = document.getElementById('userRole');
  const avatarImg = document.getElementById('userAvatarImg');

  const nome = (sessionStorage.getItem('user_nome') || '').trim();
  const cargo = (sessionStorage.getItem('user_cargo') || '').trim();
  const permRaw = (sessionStorage.getItem('user_permraw') || '').trim();

  const permLabel = (function(){
    if (!permRaw) return '';
    const p = permRaw.toLowerCase().trim();
    if (p === 'geral' || p === 'todos' || p === 'acesso completo') return 'Acesso Completo';
    return permRaw;
  })();

  if (elName) elName.textContent = (nome || _humanizeFromEmail(email) || '—');
  if (elRole) {
    const left = cargo || '—';
    const right = permLabel || '—';
    elRole.textContent = `${left} | ${right}`;
  }

  // Foto do colaborador pelo e-mail (match inteligente pelo nome)
  const foto = _pickFotoPorEmail(email);
  if (avatarImg) {
    if (foto && foto.file) {
      avatarImg.src = foto.file;
      avatarImg.alt = `Foto de ${foto.display || 'colaborador'}`;
      avatarImg.title = foto.display || '';
    } else {
      // fallback discreto
      avatarImg.removeAttribute('src');
      avatarImg.alt = 'Foto do usuário';
    }
  }
}

// Puxa Nome/Cargo/Permissões da planilha de login (sem mexer na regra do login)
async function _hydrateUserProfile(email){
  try{
    if (!email) return;

    // já tem algo salvo? não faz barulho
    const hasAny = (sessionStorage.getItem('user_nome') || sessionStorage.getItem('user_cargo') || sessionStorage.getItem('user_permraw'));
    if (hasAny) return;

    const resp = await fetch(URL);
    if (!resp.ok) return;
    const csv = await resp.text();
    const linhas = csv.split(/\r?\n/).map(l => l.split(','));
    const [header, ...rows] = linhas;

    const emailIdx = header.findIndex(h => h.trim().toLowerCase() === 'e-mail' || h.trim().toLowerCase() === 'email');
    if (emailIdx === -1) return;

    const nomeIdx  = header.findIndex(h => ['nome','usuário','usuario','colaborador'].includes(h.trim().toLowerCase()));
    const cargoIdx = header.findIndex(h => ['cargo','função','funcao'].includes(h.trim().toLowerCase()));
    const permIdx  = header.findIndex(h => ['permissões','permissoes','permissão','permissao'].includes(h.trim().toLowerCase()));

    const row = rows.find(r => (r[emailIdx] || '').trim().toLowerCase() === email.toLowerCase());
    if (!row) return;

    const nome = nomeIdx >= 0 ? (row[nomeIdx] || '').trim() : '';
    const cargo = cargoIdx >= 0 ? (row[cargoIdx] || '').trim() : '';
    const permRaw = permIdx >= 0 ? (row[permIdx] || '').trim() : '';
    if (nome) sessionStorage.setItem('user_nome', nome);
    if (cargo) sessionStorage.setItem('user_cargo', cargo);
    if (permRaw) sessionStorage.setItem('user_permraw', permRaw);
  }catch(e){}
}

function _humanizeFromEmail(email){
  try{
    const local = (email || '').split('@')[0] || '';
    const parts = local.split(/[._-]+/g).filter(Boolean).slice(0,3);
    if (!parts.length) return '';
    return parts.map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
  }catch(e){
    return '';
  }
}

// Tenta casar o local-part do e-mail com as fotos disponíveis
function _pickFotoPorEmail(email){
  try{
    const list = (window.COLABORADORES_FOTOS || []);
    if (!email || !list.length) return null;

    const local = (email.split('@')[0] || '').toLowerCase();
    const emailTokens = local
      .replace(/[^a-z0-9._-]+/g,'')
      .split(/[._-]+/g)
      .filter(Boolean)
      .map(t => t.replace(/[0-9]+/g,''))
      .filter(t => t.length >= 2);

    if (!emailTokens.length) return null;

    let best = null;
    let bestScore = -1;
    let bestLen = -1;

    for (const it of list){
      const slug = (it.slug || '').toLowerCase();
      const nameTokens = slug.split('-').filter(Boolean);

      // score por interseção (quanto mais tokens batem, melhor)
      let score = 0;
      for (const nt of nameTokens){
        if (emailTokens.includes(nt)) score += 2;
        else if (emailTokens.some(et => et.startsWith(nt) || nt.startsWith(et))) score += 1;
      }

      // bônus se TODOS os tokens do nome aparecem (ou quase)
      const overlap = nameTokens.filter(nt => emailTokens.some(et => et === nt || et.startsWith(nt) || nt.startsWith(et))).length;
      if (overlap === nameTokens.length) score += 3;

      // desempate: mais tokens e nome maior
      const len = nameTokens.length;

      if (score > bestScore || (score === bestScore && len > bestLen)){
        best = it;
        bestScore = score;
        bestLen = len;
      }
    }

    // só aceita se tiver algum match real
    if (bestScore <= 0) return null;
    return best;
  }catch(e){
    return null;
  }
}


function _bindSidebarToggle(){
  const btn = document.getElementById('sidebarToggle');
  const sidebar = document.getElementById('sidebar');
  const main = document.getElementById('mainContent');
  if (!btn || !sidebar || !main) return;

  const saved = localStorage.getItem('plataforma_sidebar_collapsed') === 'true';
  if (saved) {
    sidebar.classList.add('is-collapsed');
    main.classList.add('is-expanded');
  }

  btn.onclick = () => {
    const collapsed = sidebar.classList.toggle('is-collapsed');
    main.classList.toggle('is-expanded', collapsed);
    localStorage.setItem('plataforma_sidebar_collapsed', collapsed ? 'true' : 'false');
  };
}


function _renderWelcome(){
  const wrap = document.getElementById('dashboards');
  if (!wrap) return;
  if (wrap.innerHTML && wrap.innerHTML.trim().length) return;

  wrap.innerHTML = `
    <div class="welcome">
      <img class="welcome-logo" src="Imagens/Logo_Plataforma_Preto.png" alt="Logo Plataforma" />
      <div class="welcome-title">Bem-vindo 👋</div>
      <div class="welcome-sub">Escolha um setor no menu para ver seus dashboards.</div>
    </div>
  `;
}
