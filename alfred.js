/* =============================
   Alfred 🕵🏼 — Plataforma + Banco de Dados
   - Faz perguntas em linguagem natural
   - Envia contexto do portal + dashboard atual para o backend
   - Backend gera SQL, consulta MySQL e responde em português
   ============================= */

(function(){
  function escapeHtmlToSafeText(s){
    return String(s ?? '').replace(/[&<>"']/g, m => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;' }[m]));
  }

  function stripMarkdownLoose(text){
    let t = String(text ?? '');
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    t = t.replace(/\*\*([^*]+)\*\*/g, '$1');
    t = t.replace(/__([^_]+)__/g, '$1');
    t = t.replace(/\*([^*]+)\*/g, '$1');
    t = t.replace(/_([^_]+)_/g, '$1');
    t = t.replace(/`([^`]+)`/g, '$1');
    t = t.replace(/^\s*[-*+]\s+/gm, '• ');
    t = t.replace(/^\s*(\*{3,}|-{3,}|_{3,})\s*$/gm, '');
    return t;
  }

  function escapeExceptAnchors(textWithAnchors){
    const parts = String(textWithAnchors ?? '').split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
    return parts.map(p => (/^<a\b/i.test(p) ? p : escapeHtmlToSafeText(p))).join('');
  }

  function linkifyHtml(safeHtml){
    const placeholder = '__A_TAG_PLACEHOLDER__';
    const stash = [];
    let html = String(safeHtml ?? '');
    html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (m) => {
      stash.push(m);
      return placeholder + (stash.length - 1) + '__';
    });

    html = html.replace(/(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)(?=[\s<]|$)/g, (m) => {
      const url = m;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    html = html.replace(new RegExp(placeholder + '(\\d+)__', 'g'), (_, i) => stash[Number(i)] || '');
    return html;
  }

  function toOrganicHtml(rawText, { preserveAnchors = false } = {}){
    const cleaned = stripMarkdownLoose(rawText);
    const escaped = preserveAnchors ? escapeExceptAnchors(cleaned) : escapeHtmlToSafeText(cleaned);
    const withBreaks = escaped.replace(/\n/g, '<br/>');
    return linkifyHtml(withBreaks);
  }

  function _extractSrc(html){
    const m = String(html || '').match(/src\s*=\s*['\"]([^'\"]+)['\"]/i);
    return m ? m[1] : null;
  }

  function getCurrentDashboardMeta(){
    const iframe = document.querySelector('#dashboards iframe');
    if (!iframe) return { aberto: false };

    return {
      aberto: true,
      titulo: iframe.getAttribute('title') || '',
      src: iframe.getAttribute('src') || ''
    };
  }

  function getVisibleDashboardCards(){
    try {
      return Array.from(document.querySelectorAll('.dashboard-card, .dash-card, [data-dash], .card')).slice(0, 20).map(el => {
        const titleEl = el.querySelector('h3, h4, .dashboard-title, .dash-title, strong');
        return (titleEl?.textContent || el.textContent || '').trim();
      }).filter(Boolean);
    } catch (_) {
      return [];
    }
  }

  function buildPortalContext(extra){
    const perms = window.permissoesAtuais || null;
    const hasPerms = perms && typeof perms === 'object' && Object.keys(perms).length;

    const deps = hasPerms ? Object.keys(perms) : [];
    const depList = deps.map(dep => {
      const ds = Array.isArray(perms[dep]) ? perms[dep] : [];
      return {
        departamento: dep,
        dashboards: ds.map(d => ({
          nome: d?.nome || '',
          tipo: d?.tipo || 'PBI',
          iframe_src: _extractSrc(d?.iframe || '')
        }))
      };
    });

    return {
      app: 'Projeto_Plataforma - Alfred com banco',
      usuario_logado: sessionStorage.getItem('logado') === 'true',
      user_nome: sessionStorage.getItem('user_nome') || '',
      user_cargo: sessionStorage.getItem('user_cargo') || '',
      user_permissao: sessionStorage.getItem('user_permraw') || '',
      dashboard_atual: getCurrentDashboardMeta(),
      dashboards_visiveis: getVisibleDashboardCards(),
      permissoes: hasPerms ? depList : [],
      extra: extra || null
    };
  }

  async function askAlfred(question, extra){
    const response = await fetch('/api/alfred/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        question,
        portalContext: buildPortalContext(extra)
      })
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.error || `HTTP ${response.status}`);
    }

    return payload;
  }

  function createAlfredUI(instanceId){
    const root = document.createElement('div');
    root.className = 'alfred-card';
    root.innerHTML = `
      <div class="alfred-head">
        <div class="alfred-title">🕵🏼 Alfred</div>
        <button class="alfred-toggle" type="button" aria-label="Recolher/expandir Alfred">▾</button>
      </div>
      <div class="alfred-body">
        <div class="alfred-answer" aria-live="polite"><span class="alfred-muted">Me pergunta qualquer coisa do banco ✨</span></div>
        <div class="alfred-row">
          <input class="alfred-input" type="text" placeholder="Ex: qual o principal destino no mês de janeiro?" />
          <button class="alfred-btn" type="button">Enviar</button>
        </div>
        <div class="alfred-hint">Dica: eu consulto o banco em tempo real 👀</div>
      </div>
    `;

    const toggleBtn = root.querySelector('.alfred-toggle');

    function setCollapsed(isCollapsed){
      root.classList.toggle('collapsed', !!isCollapsed);
      if (toggleBtn) toggleBtn.textContent = isCollapsed ? '▸' : '▾';
      try{ localStorage.setItem(`alfred_collapsed_${instanceId}`, isCollapsed ? '1' : '0'); }catch{}
    }

    function restoreCollapsed(){
      try{
        const v = localStorage.getItem(`alfred_collapsed_${instanceId}`);
        setCollapsed(v === '1');
      }catch{ setCollapsed(false); }
    }

    toggleBtn?.addEventListener('click', () => {
      const nowCollapsed = !(root.classList.contains('collapsed'));
      setCollapsed(nowCollapsed);
    });

    restoreCollapsed();

    const inputEl = root.querySelector('.alfred-input');
    const btnEl = root.querySelector('.alfred-btn');
    const answerEl = root.querySelector('.alfred-answer');

    function setAnswer(html){
      if (!answerEl) return;
      answerEl.innerHTML = html;
    }

    async function onAsk(){
      const q = (inputEl?.value ?? '').trim();
      if (!q){
        setAnswer('<span class="alfred-muted">Digita uma pergunta aí 🙂</span>');
        return;
      }

      if (btnEl) btnEl.disabled = true;
      setAnswer('<span class="alfred-muted">Pensando, gerando SQL e fuçando o banco… 🤖</span>');

      try{
        const result = await askAlfred(q, { instanceId });
        const answer = String(result?.answer || '').trim();
        const safeAnswer = answer || 'Não encontrei uma resposta útil com os dados retornados.';
        const meta = [];
        if (typeof result?.rowCount === 'number') meta.push(`${result.rowCount} linha(s)`);
        if (result?.sql) meta.push('SQL gerada com sucesso');

        setAnswer(`
          <div class="alfred-text">${toOrganicHtml(safeAnswer)}</div>
          <div class="alfred-hint" style="margin-top:10px;opacity:.8;">${escapeHtmlToSafeText(meta.join(' • '))}</div>
        `);
      } catch(err){
        console.error(err);
        const msg = err?.message ? String(err.message) : String(err);
        setAnswer(`<span class="alfred-err">Deu ruim no Alfred: ${escapeHtmlToSafeText(msg)}</span><br/><span class="alfred-muted">Confere se o backend está rodando e se o .env está preenchido.</span>`);
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    }

    btnEl?.addEventListener('click', onAsk);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAsk();
    });

    return {
      el: root,
      focus(){ try{ inputEl?.focus(); }catch{} },
      setPlaceholder(p){ if (inputEl) inputEl.placeholder = p; },
      setHint(t){ const h = root.querySelector('.alfred-hint'); if (h) h.textContent = t; }
    };
  }

  let sidebarInstance = null;
  let belowInstance = null;

  function mountSidebar(){
    const mount = document.getElementById('alfredSidebarMount');
    if (!mount || sidebarInstance) return;
    sidebarInstance = createAlfredUI('sidebar');
    sidebarInstance.setPlaceholder('Ex: principal destino em janeiro');
    mount.appendChild(sidebarInstance.el);
  }

  function mountBelow(container, extra){
    if (!container) return;

    let wrap = container.querySelector('#alfredBelowWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'alfredBelowWrap';
      wrap.className = 'alfred-below-wrap';
      container.appendChild(wrap);
    }

    const iframe = container.querySelector('iframe');
    wrap.style.display = iframe ? 'block' : 'none';

    if (!belowInstance){
      belowInstance = createAlfredUI('below');
      belowInstance.setPlaceholder('Pergunte sobre esse dashboard ou o banco');
      belowInstance.setHint('Dica: eu uso o contexto da tela + banco de dados 🚀');
      wrap.appendChild(belowInstance.el);
    } else {
      try{
        if (belowInstance.el && belowInstance.el.parentNode !== wrap){
          wrap.appendChild(belowInstance.el);
        }
      }catch{}
    }

    try{
      const dep = extra?.dep ? String(extra.dep) : '';
      const dash = extra?.dash ? String(extra.dash) : '';
      if (dep || dash){
        belowInstance.setPlaceholder(`Ex: no dashboard ${dash || 'atual'}, qual o top destino?`);
      }
    }catch{}
  }

  document.addEventListener('DOMContentLoaded', () => {
    try{ mountSidebar(); }catch{}
  });

  window.ALFRED = {
    mountSidebar,
    mountBelow
  };
})();
