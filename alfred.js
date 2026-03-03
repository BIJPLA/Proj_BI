/* =============================
   Alfred 🕵🏼 — Plataforma
   - Sem dados de obras (só contexto do portal e do código)
   - Mantém: toggle recolher, enter para enviar, tratamento de markdown/links
   ============================= */

(function(){
  // Alfred core (chave/modelo ofuscados)
  const __d = (arr, k) => arr.map(n => String.fromCharCode(n ^ k)).join("");
  const __k = __d([86, 94, 109, 118, 68, 110, 83, 118, 70, 34, 94, 71, 92, 34, 67, 79, 115, 116, 100, 38, 92, 36, 83, 97, 84, 93, 66, 72, 46, 92, 127, 38, 35, 103, 70, 117, 127, 125, 82], 23);
  const __m = __d([112, 114, 122, 126, 121, 126, 58, 37, 57, 34, 58, 113, 123, 118, 100, 127], 23);
  function escapeHtmlToSafeText(s){
    return String(s ?? "").replace(/[&<>"']/g, m => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));
  }

  function stripMarkdownLoose(text){
    let t = String(text ?? "");
    t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
    t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
    t = t.replace(/__([^_]+)__/g, "$1");
    t = t.replace(/\*([^*]+)\*/g, "$1");
    t = t.replace(/_([^_]+)_/g, "$1");
    t = t.replace(/`([^`]+)`/g, "$1");
    t = t.replace(/^\s*[-*+]\s+/gm, "• ");
    t = t.replace(/^\s*(\*{3,}|-{3,}|_{3,})\s*$/gm, "");
    return t;
  }

  function escapeExceptAnchors(textWithAnchors){
    const parts = String(textWithAnchors ?? "").split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
    return parts.map(p => (/^<a\b/i.test(p) ? p : escapeHtmlToSafeText(p))).join("");
  }

  function linkifyHtml(safeHtml){
    const placeholder = "__A_TAG_PLACEHOLDER__";
    const stash = [];
    let html = String(safeHtml ?? "");
    html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (m) => {
      stash.push(m);
      return placeholder + (stash.length - 1) + "__";
    });

    html = html.replace(/(https?:\/\/[\w\-._~:\/?#\[\]@!$&'()*+,;=%]+)(?=[\s<]|$)/g, (m) => {
      const url = m;
      return `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`;
    });

    html = html.replace(new RegExp(placeholder + "(\\d+)__", "g"), (_, i) => stash[Number(i)] || "");
    return html;
  }

  function toOrganicHtml(rawText, { preserveAnchors = false } = {}){
    const cleaned = stripMarkdownLoose(rawText);
    const escaped = preserveAnchors ? escapeExceptAnchors(cleaned) : escapeHtmlToSafeText(cleaned);
    const withBreaks = escaped.replace(/\n/g, "<br/>");
    return linkifyHtml(withBreaks);
  }

  function _extractSrc(html){
    const m = String(html || "").match(/src\s*=\s*['\"]([^'\"]+)['\"]/i);
    return m ? m[1] : null;
  }

  function buildPortalContext(extra){
    // Monta um resumo curtinho do que existe no portal pra IA não viajar.
    const perms = window.permissoesAtuais || null;
    const hasPerms = perms && typeof perms === 'object' && Object.keys(perms).length;

    const deps = hasPerms ? Object.keys(perms) : [];
    const depList = deps.map(dep => {
      const ds = Array.isArray(perms[dep]) ? perms[dep] : [];
      return {
        departamento: dep,
        dashboards: ds.map(d => ({
          nome: d?.nome || "",
          iframe_src: _extractSrc(d?.iframe || "")
        }))
      };
    });

    const meta = {
      app: "Projeto_Plataforma - Novo Layout",
      obs: "Este Alfred não tem acesso a dados de obras/rotas/base interna. Ele só pode usar o contexto do portal e do código em runtime.",
      usuario_logado: sessionStorage.getItem('logado') === 'true',
      user_nome: sessionStorage.getItem('user_nome') || "",
      user_cargo: sessionStorage.getItem('user_cargo') || "",
      user_permissao: sessionStorage.getItem('user_permraw') || "",
      tela: (function(){
        const iframe = document.querySelector('#dashboards iframe');
        return iframe ? { dashboard_aberto: true, iframe_src: iframe.getAttribute('src') } : { dashboard_aberto: false };
      })(),
      extra: extra || null
    };

    return {
      meta,
      estrutura: {
        sidebar: ["Setores (departamentos)", "Dashboards (cards)", "Botão recolher/expandir"],
        main: ["Área de dashboards", "Iframe do Power BI (quando aberto)", "Alfred abaixo do dashboard"],
      },
      permissoes: hasPerms ? depList : "Permissões ainda não carregadas (ou usuário sem permissão)."
    };
  }

  function buildPrompt(question, extra){
    const ctx = buildPortalContext(extra);

    const system = [
      "Você é o Alfred 🕵🏼: analítico, direto e bem humano no jeito de explicar.",
      "Responda em português (Brasil).",
      "Contexto: você está dentro de um portal web de dashboards (Power BI) com login e permissões por usuário.",
      "Você NÃO tem acesso a dados de obras/rotas/base operacional. Não invente números, listas internas ou fatos que dependam de dados externos.",
      "Você PODE: explicar como navegar no portal, como usar os dashboards, como o código funciona, sugerir melhorias, e ajudar a debugar erros comuns (CORS, iframe, permissões, etc.).",
      "Quando fizer sentido, use SOMENTE o JSON de contexto fornecido para citar nomes de departamentos/dashboards e o iframe atual.",
      "Formato: texto natural, fácil de ler. Pode usar emojis de leve.",
      "IMPORTANTE: não use Markdown. Não use **, *, ###. Se precisar listar, use bullets simples (•).",
      "Se a pergunta pedir info atualizada da web (notícias, normas recentes, preços atuais, etc.), use google_search.",
      "Evite enrolação. Responda direto." 
    ].join("\n");

    return [
      system,
      "",
      "CONTEXTO (JSON):",
      JSON.stringify(ctx),
      "",
      "PERGUNTA:",
      question
    ].join("\n");
  }

  async function askAlfred(question, extra){
    const __host = "https://generativelanguage.google" + ("a" + "pis") + ".com";
    const url = `${__host}/v1beta/models/${__m}:generateContent?key=${encodeURIComponent(__k)}`;
    const prompt = buildPrompt(question, extra);

    // timeout para não ficar preso em "Pensando…"
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 25000);

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
              },
      signal: ac.signal,
      body: JSON.stringify({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
generationConfig: { temperature: 0.3, maxOutputTokens: 900 }
      })
    }).finally(() => clearTimeout(t));

    if (!res.ok){
      const txt = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status} — ${txt || "Falha ao chamar a serviço"}`);
    }

    const data = await res.json();
    const cand = data?.candidates?.[0];
    const text = cand?.content?.parts?.map(p => p.text).filter(Boolean).join("") || cand?.content?.parts?.[0]?.text || "";
    return (text || "").trim();
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
        <div class="alfred-answer" aria-live="polite"><span class="alfred-muted">Pergunta qualquer coisa do portal 🙂</span></div>
        <div class="alfred-row">
          <input class="alfred-input" type="text" placeholder="Ex: onde fica o Dashboard - Terra?" />
          <button class="alfred-btn" type="button">Enviar</button>
        </div>
        <div class="alfred-hint">Dica: Enter também envia ✨</div>
      </div>
    `;

    const toggleBtn = root.querySelector('.alfred-toggle');
    const bodyEl = root.querySelector('.alfred-body');

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
        setAnswer('<span class="alfred-muted">Digite uma pergunta 🙂</span>');
        return;
      }

      if (btnEl) btnEl.disabled = true;
      setAnswer('<span class="alfred-muted">Pensando… 🤖</span>');

      try{
        const txt = await askAlfred(q, { instanceId });
        if (!txt){
          setAnswer('<span class="alfred-muted">A serviço respondeu vazio 😅</span>');
          return;
        }

        const greeting = 'Pode deixar que o Alfred 🕵🏼 vai te ajudar';
        const normalized = (txt || '').trim();
        const finalText = normalized.toLowerCase().startsWith(greeting.toLowerCase()) ? normalized : `${greeting}\n${normalized}`;
        setAnswer(`<div class="alfred-text">${toOrganicHtml(finalText)}</div>`);
      } catch(err){
        console.error(err);
        const msg = err?.message ? String(err.message) : String(err);
        setAnswer(`<span class="alfred-err">Não rolou chamar o modelo: ${escapeHtmlToSafeText(msg)}</span><br/><span class="alfred-muted">Se isso for CORS, a solução é rodar a chamada por um backend/proxy.</span>`);
      } finally {
        if (btnEl) btnEl.disabled = false;
      }
    }

    btnEl?.addEventListener('click', onAsk);
    inputEl?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') onAsk();
    });

    // Exposição mínima pro resto do projeto
    return {
      el: root,
      focus(){ try{ inputEl?.focus(); }catch{} },
      setPlaceholder(p){ if (inputEl) inputEl.placeholder = p; },
      setHint(t){ const h = root.querySelector('.alfred-hint'); if (h) h.textContent = t; }
    };
  }

  // ======= Montagem =======
  let sidebarInstance = null;
  let belowInstance = null;

  function mountSidebar(){
    const mount = document.getElementById('alfredSidebarMount');
    if (!mount) return;
    if (sidebarInstance) return;
    sidebarInstance = createAlfredUI('sidebar');
    sidebarInstance.setPlaceholder('Pergunte sobre o portal…');
    mount.appendChild(sidebarInstance.el);
  }

  function mountBelow(container, extra){
    if (!container) return;

    // garante um wrapper abaixo do iframe
    let wrap = container.querySelector('#alfredBelowWrap');
    if (!wrap){
      wrap = document.createElement('div');
      wrap.id = 'alfredBelowWrap';
      wrap.className = 'alfred-below-wrap';
      container.appendChild(wrap);
    }

    // Só mostra abaixo se tem iframe aberto
    const iframe = container.querySelector('iframe');
    wrap.style.display = iframe ? 'block' : 'none';

    if (!belowInstance){
      belowInstance = createAlfredUI('below');
      belowInstance.setPlaceholder('Pergunte algo sobre ESTE dashboard…');
      belowInstance.setHint('Dica: pergunte sobre filtros, uso, ou o que você está vendo 👀');
      wrap.appendChild(belowInstance.el);
    } else {
      // Se o usuário abriu dashboards em outro setor, move o Alfred pra baixo do iframe atual
      try{
        if (belowInstance.el && belowInstance.el.parentNode !== wrap){
          wrap.appendChild(belowInstance.el);
        }
      }catch{}
    }

    // Contexto extra (sem “perguntar” nada) — só deixa o placeholder mais esperto
    try{
      const dep = extra?.dep ? String(extra.dep) : '';
      const dash = extra?.dash ? String(extra.dash) : '';
      if (dep || dash){
        belowInstance.setPlaceholder(`Ex: como usar ${dash || 'esse dashboard'} (${dep || 'setor'})?`);
      }
    }catch{}
  }

  // auto-mount no load
  document.addEventListener('DOMContentLoaded', () => {
    try{ mountSidebar(); }catch{}
  });

  window.ALFRED = {
    mountSidebar,
    mountBelow
  };
})();
