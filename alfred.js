/* =====================================================
   Alfred 🕵🏼 — Chat Interface
   Histórico em memória (cache de sessão)
   Consulta banco landapp_production via /api/alfred/ask
   ===================================================== */

// ─── Estado da conversa (em memória) ────────────────────────────────────────
const _alfredState = {
  history: [],       // [{ role: 'user'|'alfred', text: '', time: '' }]
  loading: false,
  open: false
};

// ─── Gerenciador de painéis (Alfred + Ferramentas) ───────────────────────────
function closeAllPanels() {
  // Fechar Alfred
  const alfredPanel = document.getElementById('alfredChatPanel');
  if (alfredPanel && _alfredState.open) {
    alfredPanel.classList.remove('acp-visible');
    setTimeout(() => { alfredPanel.style.display = 'none'; }, 280);
    _alfredState.open = false;
  }
  // Fechar ferramentas
  ['landcalcPanel', 'landmapPanel'].forEach(id => {
    const p = document.getElementById(id);
    if (p && p.style.display !== 'none') {
      p.classList.remove('acp-visible');
      setTimeout(() => { p.style.display = 'none'; }, 280);
    }
  });
}
window.closeAllPanels = closeAllPanels;

// ─── Abrir / fechar ferramentas (Calculadora e LandMap) ──────────────────────
const _toolSrcs = {
  landcalc: `apps/Land_Calc_Embed/index.html?v=${Date.now()}`,
  landmap:  'Mapa_Obras_Projeto/index.html'
};

function toolOpen(id) {
  const panelId = id + 'Panel';
  const iframeId = id + 'Iframe';
  const panel = document.getElementById(panelId);
  const sidebar = document.querySelector('.sidebar');
  if (!panel) return;

  // Fechar outros painéis primeiro
  closeAllPanels();

  setTimeout(() => {
    // Carregar iframe — usa data-loaded para evitar falso positivo do src=""
    const iframe = document.getElementById(iframeId);
    if (iframe && !iframe.dataset.loaded) {
      iframe.src = _toolSrcs[id] || '';
      iframe.dataset.loaded = '1';
    }

    const sw = sidebar ? sidebar.offsetWidth : 280;
    panel.style.left = sw + 'px';
    panel.style.display = 'flex';

    setTimeout(() => panel.classList.add('acp-visible'), 10);
  }, 300);
}
window.toolOpen = toolOpen;

function toolClose(id) {
  const panel = document.getElementById(id + 'Panel');
  if (!panel) return;
  panel.classList.remove('acp-visible');
  setTimeout(() => { panel.style.display = 'none'; }, 280);
}
window.toolClose = toolClose;

// ─── Abrir / fechar chat ─────────────────────────────────────────────────────
function alfredChatOpen() {
  const panel = document.getElementById('alfredChatPanel');
  const sidebar = document.querySelector('.sidebar');
  if (!panel) return;

  // Fechar ferramentas abertas primeiro
  closeAllPanels();

  setTimeout(() => {
    panel.style.display = 'flex';
    _alfredState.open = true;
    const sw = sidebar ? sidebar.offsetWidth : 280;
    panel.style.left = sw + 'px';
    setTimeout(() => {
      panel.classList.add('acp-visible');
      document.getElementById('alfredInput')?.focus();
    }, 10);
  }, 300);
}

function alfredChatClose() {
  const panel = document.getElementById('alfredChatPanel');
  if (!panel) return;
  panel.classList.remove('acp-visible');
  setTimeout(() => {
    panel.style.display = 'none';
    _alfredState.open = false;
  }, 280);
}

// ─── Limpar histórico ────────────────────────────────────────────────────────
function alfredChatClear() {
  _alfredState.history = [];
  const msgs = document.getElementById('alfredMessages');
  if (!msgs) return;
  msgs.innerHTML = `
    <div class="acp-welcome">
      <div class="acp-welcome-icon">🕵🏼</div>
      <div class="acp-welcome-title">Nova conversa iniciada.</div>
      <div class="acp-welcome-sub">Me pergunte qualquer coisa sobre os dados da LandApp!</div>
      <div class="acp-suggestions">
        <button class="acp-suggestion" onclick="alfredSuggest(this)">Qual o destino mais atendido este mês?</button>
        <button class="acp-suggestion" onclick="alfredSuggest(this)">Quantas viagens foram finalizadas hoje?</button>
        <button class="acp-suggestion" onclick="alfredSuggest(this)">Quais os 5 clientes com mais fretes?</button>
        <button class="acp-suggestion" onclick="alfredSuggest(this)">Qual motorista fez mais viagens?</button>
      </div>
    </div>`;
}

// ─── Sugestões rápidas ───────────────────────────────────────────────────────
function alfredSuggest(btn) {
  const input = document.getElementById('alfredInput');
  if (!input) return;
  input.value = btn.textContent;
  alfredInputResize(input);
  input.focus();
  alfredChatSend();
}

// ─── Redimensionar textarea automaticamente ───────────────────────────────────
function alfredInputResize(el) {
  el.style.height = 'auto';
  el.style.height = Math.min(el.scrollHeight, 160) + 'px';
}

// ─── Detectar Enter ───────────────────────────────────────────────────────────
function alfredInputKey(e) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    alfredChatSend();
  }
}

// ─── Formatar hora ────────────────────────────────────────────────────────────
function _alfredTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

// ─── Renderizar mensagem ──────────────────────────────────────────────────────
function _alfredRenderMsg({ role, text, time }) {
  const msgs = document.getElementById('alfredMessages');
  if (!msgs) return;

  // Remover welcome se ainda estiver lá
  const welcome = msgs.querySelector('.acp-welcome');
  if (welcome) welcome.remove();

  const el = document.createElement('div');
  el.className = role === 'user' ? 'acp-msg acp-msg-user' : 'acp-msg acp-msg-alfred';

  const safeText = _alfredEscape(text).replace(/\n/g, '<br/>');

  if (role === 'alfred') {
    el.innerHTML = `
      <div class="acp-avatar">🕵🏼</div>
      <div class="acp-bubble-wrap">
        <div class="acp-bubble">${safeText}</div>
        <div class="acp-msg-time">${time}</div>
      </div>`;
  } else {
    el.innerHTML = `
      <div class="acp-bubble-wrap">
        <div class="acp-bubble">${safeText}</div>
        <div class="acp-msg-time">${time}</div>
      </div>`;
  }

  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

// ─── Typing indicator ─────────────────────────────────────────────────────────
function _alfredShowTyping() {
  const msgs = document.getElementById('alfredMessages');
  if (!msgs) return;
  const el = document.createElement('div');
  el.className = 'acp-msg acp-msg-alfred';
  el.id = 'alfredTyping';
  el.innerHTML = `
    <div class="acp-avatar">🕵🏼</div>
    <div class="acp-bubble-wrap">
      <div class="acp-bubble acp-typing">
        <span></span><span></span><span></span>
      </div>
    </div>`;
  msgs.appendChild(el);
  msgs.scrollTop = msgs.scrollHeight;
}

function _alfredHideTyping() {
  document.getElementById('alfredTyping')?.remove();
}

// ─── Escapar HTML ─────────────────────────────────────────────────────────────
function _alfredEscape(s) {
  return String(s ?? '').replace(/[&<>"']/g, m =>
    ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m])
  );
}

// ─── Enviar pergunta ──────────────────────────────────────────────────────────
async function alfredChatSend() {
  if (_alfredState.loading) return;

  const input = document.getElementById('alfredInput');
  const sendBtn = document.getElementById('alfredSendBtn');
  const q = (input?.value ?? '').trim();
  if (!q) return;

  // Limpar input
  input.value = '';
  alfredInputResize(input);

  const time = _alfredTime();

  // Renderizar mensagem do usuário
  _alfredState.history.push({ role: 'user', text: q, time });
  _alfredRenderMsg({ role: 'user', text: q, time });

  // Bloquear UI e mostrar typing
  _alfredState.loading = true;
  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.innerHTML = '<span class="material-symbols-outlined">stop_circle</span>';
  }
  _alfredShowTyping();

  try {
    const res = await fetch('/api/alfred/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question: q,
        history: _alfredState.history.slice(-6).map(h => ({ role: h.role, text: h.text })),
        portalContext: _alfredBuildContext()
      })
    });

    const data = await res.json().catch(() => ({}));
    _alfredHideTyping();

    const answerTime = _alfredTime();
    const answerText = data?.ok
      ? (data.answer || 'Não encontrei uma resposta útil.')
      : (data?.error || 'Algo deu errado. Tente novamente.');

    _alfredState.history.push({ role: 'alfred', text: answerText, time: answerTime });
    _alfredRenderMsg({ role: 'alfred', text: answerText, time: answerTime });

  } catch (err) {
    _alfredHideTyping();
    const errTime = _alfredTime();
    const errText = 'Não consegui conectar. Verifique sua conexão e tente novamente.';
    _alfredState.history.push({ role: 'alfred', text: errText, time: errTime });
    _alfredRenderMsg({ role: 'alfred', text: errText, time: errTime });
  } finally {
    _alfredState.loading = false;
    if (sendBtn) {
      sendBtn.disabled = false;
      sendBtn.innerHTML = '<span class="material-symbols-outlined">arrow_upward</span>';
    }
    input?.focus();
  }
}

// ─── Contexto do portal ───────────────────────────────────────────────────────
function _alfredBuildContext() {
  try {
    return {
      usuario_logado: sessionStorage.getItem('logado') === 'true',
      user_nome: sessionStorage.getItem('user_nome') || '',
      user_cargo: sessionStorage.getItem('user_cargo') || '',
    };
  } catch { return {}; }
}

// ─── Ajustar painel quando sidebar recolhe ─────────────────────────────────
function alfredAdjustPanel() {
  if (!_alfredState.open) return;
  const panel = document.getElementById('alfredChatPanel');
  const sidebar = document.querySelector('.sidebar');
  if (!panel || !sidebar) return;
  panel.style.left = sidebar.offsetWidth + 'px';
}

// ─── Observar mudanças na sidebar ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  const sidebar = document.querySelector('.sidebar');
  if (sidebar) {
    const obs = new MutationObserver(alfredAdjustPanel);
    obs.observe(sidebar, { attributes: true, attributeFilter: ['class', 'style'] });
  }

  // Fechar com ESC
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _alfredState.open) alfredChatClose();
  });
});

// ─── Expor global (compatibilidade com dashboard_obf.js) ─────────────────────
window.ALFRED = {
  mountSidebar: () => {},
  mountBelow: () => {}
};
