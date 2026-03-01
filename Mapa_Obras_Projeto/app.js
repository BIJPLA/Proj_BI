import { OBRAS, ULTIMA_DATA_BASE } from "./data.js";

/** ========= util ========= */
function norm(s){ return (s ?? "").toString().trim().toLowerCase(); }

function fmtBRL(v){
  if (v === null || v === undefined || v === "" || Number.isNaN(v)) return "—";
  const n = Number(v);
  if (!Number.isFinite(n)) return "—";
  try { return new Intl.NumberFormat("pt-BR", { style:"currency", currency:"BRL" }).format(n); }
  catch { return "R$ " + n.toFixed(2); }
}


function fmtDateTimeBR(d){
  if (!d) return "";
  try{
    return new Intl.DateTimeFormat("pt-BR", {
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit"
    }).format(d);
  }catch{
    // fallback bem humilde
    const pad = (n)=> String(n).padStart(2,"0");
    return `${pad(d.getDate())}/${pad(d.getMonth()+1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
  }
}

function volumeLabel(raw){
  const v = (raw ?? "").toString().trim().toUpperCase();
  if (v === "CUT_VOLUME") return "Corte";
  if (v === "TRUCK_VOLUME" || v === "RUBBLE_VOLUME") return "Caminhão"; // TRUCK_VOLUME aparece no CSV
  if (v === "RUBBLE_VOLUME") return "Entulho";
  // compat: você mencionou RUBBLE_VOLUME como Entulho, então vamos priorizar isso:
  if (v === "RUBBLE_VOLUME") return "Entulho";
  return raw ? raw : "—";
}

// interpretação exatamente como você pediu (com tolerância de variação)
function volumeLabel2(raw){
  const s = (raw ?? "").toString().trim();
  // Interpretação pedida:
  // Cut_volume = Corte
  // Rubble_Volume = Caminhão
  // RUBBLE_VOLUME = Entulho
  if (s === "Cut_volume" || s.toUpperCase() === "CUT_VOLUME") return "Corte";
  if (s === "Rubble_Volume" || s.toUpperCase() === "TRUCK_VOLUME") return "Caminhão";
  if (s === "RUBBLE_VOLUME") return "Entulho";
  return s ? s : "—";
}

function volumeColor(raw){
  const s = (raw ?? "").toString().trim();
  if (s === "Cut_volume" || s.toUpperCase() === "CUT_VOLUME") return "#ffb020";   // Corte
  if (s === "Rubble_Volume" || s.toUpperCase() === "TRUCK_VOLUME") return "#4cc9f0"; // Caminhão
  if (s === "RUBBLE_VOLUME") return "#2ee59d"; // Entulho
  return "#a0a7b4";
}

function distanciaKm(lat1,lng1,lat2,lng2){
  const R = 6371;
  const dLat = (lat2-lat1) * Math.PI/180;
  const dLng = (lng2-lng1) * Math.PI/180;
  const a =
    Math.sin(dLat/2)**2 +
    Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLng/2)**2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** ========= mapa ========= */
const DEFAULT_VIEW = { center: [-23.55052, -46.633308], zoom: 12 };
const map = L.map("map", { zoomControl:true }).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
  maxZoom: 19,
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

const markersLayer = L.layerGroup().addTo(map);

function makePinIcon(fill, ring=false){
  // ring = destaca quando está dentro do raio
  const stroke = ring ? "rgba(255,255,255,.95)" : "rgba(255,255,255,.65)";
  const sw = ring ? 2.4 : 1.5;
  return new L.DivIcon({
    className: "",
    html: `
      <svg width="28" height="44" viewBox="0 0 28 44">
        <path d="M14 43C14 43 2 28.5 2 18C2 9.2 7.8 3 14 3C20.2 3 26 9.2 26 18C26 28.5 14 43 14 43Z"
              fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>
        <circle cx="14" cy="18" r="6" fill="rgba(0,0,0,.22)"/>
      </svg>`,
    iconSize: [28,44],
    iconAnchor: [14,44],
    popupAnchor: [0,-36],
  });
}

const iconFocus = makePinIcon("#7c5cff", true);

/** ========= estado ========= */
const state = {
  filtro: {
    cliente: "",
    obra: "",
    destino: "",
    tipo: "",
    regiao: "",
    bairro: ""
  },
  foco: { lat:null, lng:null, raioKm:null, enderecoTxt:"" },
  obras: [] // { ...obra, marker }
};

const elLista = document.getElementById("listaObras");
const elStatus = document.getElementById("status");
const elCountPill = document.getElementById("countPill");
const elFiltroPill = document.getElementById("filtroPill");

function setStatus(msg){ elStatus.textContent = msg; }

function escapeHtml(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

/** ========= geocoding ========= */
async function geocodificar(endereco){
  const url = "https://nominatim.openstreetmap.org/search?format=json&limit=1&q=" + encodeURIComponent(endereco);
  const res = await fetch(url, { headers: { "Accept":"application/json" } });
  if(!res.ok) throw new Error("Falha no geocoding: " + res.status);
  const data = await res.json();
  if(!data || !data[0]) return null;
  return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
}

/** ========= popup ========= */
function buildPopup(obra){
  const lat = obra.lat?.toFixed?.(6) ?? obra.lat;
  const lng = obra.lng?.toFixed?.(6) ?? obra.lng;

  const dtStr = ULTIMA_DATA_BASE ? fmtDateTimeBR(new Date(ULTIMA_DATA_BASE)) : "";
const header = `
    <div style="min-width:280px">
      <div style="font-weight:900;font-size:14px;margin-bottom:6px">${escapeHtml(obra.obra_nome)}</div>
      <div style="font-size:12px;color:#556;margin-bottom:8px">
        <b>lat</b>: ${escapeHtml(lat)} &nbsp; | &nbsp; <b>lng</b>: ${escapeHtml(lng)}
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px;font-size:12px">
        <div><b>Cliente:</b> ${escapeHtml(obra.cliente ?? "—")}</div>
        <div><b>Tipo:</b> ${escapeHtml(volumeLabel2(obra.volume_type_raw))}</div>
        <div><b>Cidade:</b> ${escapeHtml(obra.city ?? "—")}</div>
        <div><b>Bairro:</b> ${escapeHtml(obra.neighborhood ?? "—")}</div>
        ${dtStr ? `<div><b>Data:</b> ${escapeHtml(dtStr)}</div>` : ""}
        <div><b>Região:</b> ${escapeHtml(obra.region ?? "—")}</div>
      </div>
  `;

  const rotas = Array.isArray(obra.rotas) ? obra.rotas : [];
  const max = 8;
  const show = rotas.slice(0, max);

  const rows = show.map(r => `
    <tr>
      <td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,.08)">${escapeHtml(r.rota_nome ?? "—")}</td>
      <td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,.08)">${escapeHtml(r.destino_nome ?? "—")}</td>
      <td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,.08)">${escapeHtml(fmtBRL(r.preco_cliente))}</td>
      <td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,.08)">${escapeHtml(fmtBRL(r.preco_motorista))}</td>
      <td style="padding:6px 8px;border-top:1px solid rgba(0,0,0,.08)">${escapeHtml(fmtBRL(r.preco_destino))}</td>
    </tr>
  `).join("");

  const more = rotas.length > max ? `<div style="margin-top:8px;color:#556;font-size:12px">+ ${rotas.length - max} rota(s) não exibida(s)…</div>` : "";

  const table = `
    <div style="font-weight:800;margin:6px 0 6px">Rotas</div>
    <div style="overflow:auto;max-height:260px;border:1px solid rgba(0,0,0,.10);border-radius:10px">
      <table style="border-collapse:collapse;width:100%;font-size:12px;background:#fff">
        <thead>
          <tr style="background:#f6f7ff">
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08)">Nome da Rota</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08)">Destino</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08)">Preço Cliente</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08)">Preço Motorista</th>
            <th style="text-align:left;padding:8px;border-bottom:1px solid rgba(0,0,0,.08)">Preço Destino</th>
          </tr>
        </thead>
        <tbody>${rows || `<tr><td colspan="5" style="padding:10px;color:#556">Sem rotas nessa obra.</td></tr>`}</tbody>
      </table>
    </div>
    ${more}
    </div>
  `;

  return header + table;
}

/** ========= filtros ========= */
function readFilters(){
  state.filtro.cliente = norm(document.getElementById("fCliente").value);
  state.filtro.obra    = norm(document.getElementById("fObra").value);
  state.filtro.destino = norm(document.getElementById("fDestino").value);
  state.filtro.tipo    = (document.getElementById("fTipo").value ?? "").trim().toUpperCase();
  state.filtro.regiao  = (document.getElementById("fRegiao").value ?? "").trim().toUpperCase();
  state.filtro.bairro  = norm(document.getElementById("fBairro").value);

  const active = [];
  if (state.filtro.cliente) active.push("Cliente");
  if (state.filtro.obra) active.push("Obra");
  if (state.filtro.destino) active.push("Destino");
  if (state.filtro.tipo) active.push("Tipo");
  if (state.filtro.regiao) active.push("Região");
  if (state.filtro.bairro) active.push("Bairro");
  elFiltroPill.textContent = active.length ? `${active.length} filtro(s)` : "Sem filtros";
}

function matchesFilters(obra){
  const f = state.filtro;

  if (f.cliente && !norm(obra.cliente).includes(f.cliente)) return false;
  if (f.obra && !norm(obra.obra_nome).includes(f.obra)) return false;
  if (f.bairro && !norm(obra.neighborhood).includes(f.bairro)) return false;

  if (f.regiao){
    const reg = (obra.region ?? "").toString().trim().toUpperCase();
    if (reg !== f.regiao) return false;
  }

  if (f.tipo){
    const t = (obra.volume_type_raw ?? "").toString().trim().toUpperCase();
    if (t !== f.tipo) return false;
  }

  if (f.destino){
    const rotas = Array.isArray(obra.rotas) ? obra.rotas : [];
    const ok = rotas.some(r => norm(r.destino_nome).includes(f.destino));
    if (!ok) return false;
  }

  return true;
}

/** ========= render ========= */
function updateMarkersAndList(){
  markersLayer.clearLayers();

  const visible = [];
  for (const o of state.obras){
    if (!matchesFilters(o)) continue;

    const hasRadius = (state.foco.lat != null && state.foco.raioKm != null);
    const insideRadius = hasRadius
      ? (distanciaKm(state.foco.lat, state.foco.lng, o.lat, o.lng) <= state.foco.raioKm)
      : true; // sem raio = não restringe

    // Se tem raio aplicado (clicou em Filtrar com raio), só mostra dentro do raio
    if (hasRadius && !insideRadius) continue;

    const icon = makePinIcon(volumeColor(o.volume_type_raw), hasRadius ? true : false);
    o.marker.setIcon(icon);
    o.marker.addTo(markersLayer);
    visible.push(o);
  }

  elCountPill.textContent = `${visible.length} obras`;

  // ordenar lista por distância (se tiver foco), senão por nome
  let sorted = visible.slice();
  if (state.foco.lat != null){
    for (const o of sorted){
      o._dist = distanciaKm(state.foco.lat, state.foco.lng, o.lat, o.lng);
    }
    sorted.sort((a,b) => (a._dist ?? 1e9) - (b._dist ?? 1e9));
  } else {
    sorted.sort((a,b) => norm(a.obra_nome).localeCompare(norm(b.obra_nome)));
  }

  // render lista
  elLista.innerHTML = "";
  for (const o of sorted){
    const dist = state.foco.lat != null ? o._dist : null;

    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `
      <div class="t">${escapeHtml(o.obra_nome)}</div>
      <div class="a">${escapeHtml(o.city ?? "—")} • ${escapeHtml(o.neighborhood ?? "—")} • ${escapeHtml(o.region ?? "—")}</div>
      <div class="m">
        <span class="tag">cliente: <b>${escapeHtml(o.cliente ?? "—")}</b></span>
        <span class="tag">tipo: <b>${escapeHtml(volumeLabel2(o.volume_type_raw))}</b></span>
        ${dist==null ? `<span class="tag">distância: —</span>` : `<span class="tag ok">distância: ${dist.toFixed(2)} km</span>`}
      </div>
    `;
    item.addEventListener("click", () => {
      map.setView([o.lat,o.lng], 15);
      o.marker.openPopup();
    });
    elLista.appendChild(item);
  }

  // Ajuste de bounds quando filtros mudam (pra não ficar “onde nada existe”)
  if (visible.length){
    const group = L.featureGroup(visible.map(o => o.marker));
    map.fitBounds(group.getBounds().pad(0.18));
  }
}

/** ========= foco por endereço + raio ========= */
let focusMarker = null;
let focusCircle = null;

async function aplicarFoco(){
  const endereco = document.getElementById("novoEndereco").value.trim();
  const raioRaw = (document.getElementById("raioKm").value ?? "").toString().trim();
  const raioKm = raioRaw ? parseFloat(raioRaw) : null;

  if(!endereco){
    setStatus("Digite um endereço no campo (pra eu não ter que adivinhar telepaticamente).");
    return;
  }
  if (raioKm !== null && (!isFinite(raioKm) || raioKm <= 0)){
    setStatus("Raio inválido. Deixa vazio pra não aplicar raio, ou coloca um número > 0.");
    return;
  }

  setStatus("Geocodificando o novo endereço…");
  let pos = null;
  try{ pos = await geocodificar(endereco); }catch(e){ console.warn(e); }
  if(!pos){
    setStatus("Não achei esse endereço 😭 Tenta deixar mais completo (cidade/UF).");
    return;
  }

  state.foco = { lat: pos.lat, lng: pos.lng, raioKm: raioKm ?? null, enderecoTxt:endereco };

  if(focusMarker){ map.removeLayer(focusMarker); focusMarker = null; }
  if(focusCircle){ map.removeLayer(focusCircle); focusCircle = null; }

  const focoSubtitle = (state.foco.raioKm != null)
    ? `<small>Raio: ${state.foco.raioKm} km</small>`
    : `<small>Sem raio (mostrando todas as obras)</small>`;

  focusMarker = L.marker([pos.lat,pos.lng], { icon: iconFocus })
    .addTo(map)
    .bindPopup(`<b>Novo endereço</b><br/>${escapeHtml(endereco)}<br/>${focoSubtitle}`)
    .openPopup();

  if (state.foco.raioKm != null){
    focusCircle = L.circle([pos.lat,pos.lng], {
      radius: state.foco.raioKm * 1000,
      weight: 2,
      opacity: 0.8,
      fillOpacity: 0.08
    }).addTo(map);
  }

  setStatus(state.foco.raioKm != null
    ? "Foco aplicado. Mostrando apenas obras dentro do raio ✅"
    : "Foco aplicado (sem raio). Lista ordenada por proximidade ✅"
  );
  updateMarkersAndList();
}

/** ========= init ========= */
function popularRegioes(){
  const sel = document.getElementById("fRegiao");
  const regs = new Set();
  for (const o of OBRAS){
    const r = (o.region ?? "").toString().trim().toUpperCase();
    if (r) regs.add(r);
  }
  const arr = Array.from(regs).sort((a,b) => a.localeCompare(b));
  for (const r of arr){
    const opt = document.createElement("option");
    opt.value = r;
    opt.textContent = r;
    sel.appendChild(opt);
  }
}

function setDatalistOptions(datalistId, values){
  const dl = document.getElementById(datalistId);
  dl.innerHTML = "";
  for (const v of values){
    const opt = document.createElement("option");
    opt.value = v;
    dl.appendChild(opt);
  }
}

function popularClientes(){
  const setv = new Set();
  for (const o of OBRAS){
    const c = (o.cliente ?? "").toString().trim();
    if (c) setv.add(c);
  }
  const arr = Array.from(setv).sort((a,b) => a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
  setDatalistOptions("dlCliente", arr);
}

function popularObras(){
  const setv = new Set();
  for (const o of OBRAS){
    const n = (o.obra_nome ?? "").toString().trim();
    if (n) setv.add(n);
  }
  const arr = Array.from(setv).sort((a,b) => a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
  setDatalistOptions("dlObra", arr);
}

function popularDestinos(){
  const setv = new Set();
  for (const o of OBRAS){
    const rotas = Array.isArray(o.rotas) ? o.rotas : [];
    for (const r of rotas){
      const d = (r.destino_nome ?? "").toString().trim();
      if (d) setv.add(d);
    }
  }
  const arr = Array.from(setv).sort((a,b) => a.localeCompare(b, "pt-BR", { sensitivity:"base" }));
  setDatalistOptions("dlDestino", arr);
}


function init(){
  setStatus("Carregando obras…");
  popularRegioes();
  popularClientes();
  popularObras();
  popularDestinos();

  state.obras = OBRAS
    .filter(o => Number.isFinite(o.lat) && Number.isFinite(o.lng))
    .map(o => {
      const marker = L.marker([o.lat, o.lng], { icon: makePinIcon(volumeColor(o.volume_type_raw), false) })
        .bindPopup(buildPopup(o));
      marker.on("click", () => marker.setPopupContent(buildPopup(o)));
      return { ...o, marker };
    });

  readFilters();
  updateMarkersAndList();
  setStatus("Pronto. Filtros e cores por tipo já estão valendo 😼");
}

document.getElementById("btnFiltrar").addEventListener("click", aplicarFoco);
function limparProximidade({ silentStatus = false } = {}){
  // remove marcador/círculo do foco e volta a mostrar todas as obras
  if(focusMarker){ map.removeLayer(focusMarker); focusMarker = null; }
  if(focusCircle){ map.removeLayer(focusCircle); focusCircle = null; }

  state.foco = { lat:null, lng:null, raioKm:null, enderecoTxt:"" };
  document.getElementById("novoEndereco").value = "";
  document.getElementById("raioKm").value = "5";

  updateMarkersAndList();
  if (!silentStatus) setStatus("Filtro de proximidade limpo ✅ (mostrando todas as obras)");
}
document.getElementById("btnLimparProximidade").addEventListener("click", () => limparProximidade());
document.getElementById("btnAplicarFiltros").addEventListener("click", () => { readFilters(); updateMarkersAndList(); });
function limparFiltros({ silentStatus = false } = {}){
  document.getElementById("fCliente").value = "";
  document.getElementById("fObra").value = "";
  document.getElementById("fDestino").value = "";
  document.getElementById("fTipo").value = "";
  document.getElementById("fRegiao").value = "";
  document.getElementById("fBairro").value = "";
  readFilters();
  updateMarkersAndList();
  if (!silentStatus) setStatus("Filtros limpos ✅");
}
document.getElementById("btnLimparFiltros").addEventListener("click", () => limparFiltros());

// bônus: aplicar filtros apertando Enter em qualquer input
["fCliente","fObra","fDestino","fBairro"].forEach(id => {
  document.getElementById(id).addEventListener("keydown", (e) => {
    if (e.key === "Enter"){ readFilters(); updateMarkersAndList(); }
  });
});

init();

/** ========= sidebar UX (logo/home + collapse + auto branco/preto) ========= */
const wrapEl = document.querySelector(".wrap");
const btnToggleSidebar = document.getElementById("btnToggleSidebar");
const btnHome = document.getElementById("btnHome");
const sidebarLogo = document.getElementById("sidebarLogo");

function setSidebarCollapsed(collapsed){
  wrapEl.classList.toggle("sidebar-collapsed", collapsed);
  try{ localStorage.setItem("landapp_sidebar_collapsed", collapsed ? "1" : "0"); }catch{}

  // ícone simples: ≡ quando aberto, › quando fechado
  const iconSpan = btnToggleSidebar?.querySelector(".icon");
  if (iconSpan) iconSpan.textContent = collapsed ? "›" : "≡";
}

function restoreSidebarCollapsed(){
  let collapsed = false;
  try{ collapsed = localStorage.getItem("landapp_sidebar_collapsed") === "1"; }catch{}
  setSidebarCollapsed(collapsed);
}

function updateLogoVariant(){
  if (!sidebarLogo) return;
  const white = sidebarLogo.dataset.logoWhite;
  const black = sidebarLogo.dataset.logoBlack;

  // regra simples e robusta: acompanha o tema do sistema
  const isDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  sidebarLogo.src = isDark ? (white || sidebarLogo.src) : (black || sidebarLogo.src);
}

function goHome(){
  // Home = reset geral + volta pro centro padrão
  limparProximidade({ silentStatus:true });
  limparFiltros({ silentStatus:true });
  map.closePopup();
  map.setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
  setStatus("Home ✅ (mapa resetado)");
}

btnToggleSidebar?.addEventListener("click", () => {
  const nowCollapsed = !wrapEl.classList.contains("sidebar-collapsed");
  setSidebarCollapsed(nowCollapsed);
});

btnHome?.addEventListener("click", (e) => {
  e.preventDefault();
  goHome();
});

// aplica no load
restoreSidebarCollapsed();
updateLogoVariant();

// troca automático quando o tema do sistema mudar
if (window.matchMedia){
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  try{ mq.addEventListener("change", updateLogoVariant); }
  catch{ try{ mq.addListener(updateLogoVariant); }catch{} }
}


/** ========= 🕵🏼Alfred (Gemini) =========
 * UI: campo acima do mapa (index.html)
 * Observação: se o navegador bloquear CORS, rode via backend/proxy.
 */
const GEMINI_API_KEY = "AIzaSyDuSOBOLtMsAdZd0Fwi2KVu-Xw2k0fflbY";
const GEMINI_MODEL = "gemini-2.5-flash"; // docs: ai.google.dev

const aiQuestionEl = document.getElementById("aiQuestion");
const aiAskBtn = document.getElementById("aiAskBtn");
const aiAnswerEl = document.getElementById("aiAnswer");
const aiBarEl = document.getElementById("aiBar");
const aiToggleBtn = document.getElementById("aiToggleBtn");

function setAICollapsed(isCollapsed){
  if (!aiBarEl) return;
  aiBarEl.classList.toggle("collapsed", !!isCollapsed);
  if (aiToggleBtn) aiToggleBtn.textContent = isCollapsed ? "▸" : "▾";
  try{ localStorage.setItem("ai_bar_collapsed", isCollapsed ? "1" : "0"); }catch{}
}

function restoreAICollapsed(){
  try{
    const v = localStorage.getItem("ai_bar_collapsed");
    setAICollapsed(v === "1");
  }catch{
    setAICollapsed(false);
  }
}

aiToggleBtn?.addEventListener("click", () => {
  const now = !(aiBarEl?.classList.contains("collapsed"));
  setAICollapsed(now);
});

restoreAICollapsed();

function safeNumber(v){
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function buildAnalytics(){
  // Resumos para o Gemini não “viajar” e também para reduzir custo/latência.
  // (A IA ainda recebe os dados completos compactados logo abaixo.)
  const byRegion = new Map(); // region -> { obras:Set, rotasCount, sumPc, sumPm, sumPd }
  const byType = new Map();   // volume_type -> { rotasCount, sumPc, sumPm, sumPd }
  const byClient = new Map(); // cliente -> { obras:Set, rotasCount, sumPc }

  let totalRotas = 0;

  for (const o of OBRAS){
    const region = (o.region ?? "").toString().trim().toUpperCase() || "(SEM REGIÃO)";
    const cliente = (o.cliente ?? "").toString().trim() || "(SEM CLIENTE)";
    const vt = (o.volume_type_raw ?? "").toString().trim() || "(SEM TIPO)";

    if (!byRegion.has(region)) byRegion.set(region, { obras: new Set(), rotasCount: 0, sumPc: 0, sumPm: 0, sumPd: 0, pcN: 0, pmN: 0, pdN: 0 });
    if (!byType.has(vt)) byType.set(vt, { rotasCount: 0, sumPc: 0, sumPm: 0, sumPd: 0, pcN: 0, pmN: 0, pdN: 0 });
    if (!byClient.has(cliente)) byClient.set(cliente, { obras: new Set(), rotasCount: 0, sumPc: 0, pcN: 0 });

    byRegion.get(region).obras.add(o.id_obra ?? o.obra_nome ?? Math.random());
    byClient.get(cliente).obras.add(o.id_obra ?? o.obra_nome ?? Math.random());

    const rotas = Array.isArray(o.rotas) ? o.rotas : [];
    for (const r of rotas){
      totalRotas++;
      byRegion.get(region).rotasCount++;
      byType.get(vt).rotasCount++;
      byClient.get(cliente).rotasCount++;

      const pc = safeNumber(r.preco_cliente);
      const pm = safeNumber(r.preco_motorista);
      const pd = safeNumber(r.preco_destino);

      if (pc != null){
        byRegion.get(region).sumPc += pc; byRegion.get(region).pcN++;
        byType.get(vt).sumPc += pc; byType.get(vt).pcN++;
        byClient.get(cliente).sumPc += pc; byClient.get(cliente).pcN++;
      }
      if (pm != null){
        byRegion.get(region).sumPm += pm; byRegion.get(region).pmN++;
        byType.get(vt).sumPm += pm; byType.get(vt).pmN++;
      }
      if (pd != null){
        byRegion.get(region).sumPd += pd; byRegion.get(region).pdN++;
        byType.get(vt).sumPd += pd; byType.get(vt).pdN++;
      }
    }
  }

  function mapToSortedArr(map, mapper){
    return Array.from(map.entries())
      .map(([k,v]) => mapper(k,v))
      .sort((a,b) => (b.count ?? 0) - (a.count ?? 0));
  }

  const regionStats = mapToSortedArr(byRegion, (region, v) => ({
    region,
    obras: v.obras.size,
    rotas: v.rotasCount,
    preco_cliente_medio: v.pcN ? (v.sumPc / v.pcN) : null,
    preco_motorista_medio: v.pmN ? (v.sumPm / v.pmN) : null,
    preco_destino_medio: v.pdN ? (v.sumPd / v.pdN) : null,
  }));

  const typeStats = mapToSortedArr(byType, (volume_type, v) => ({
    volume_type,
    rotas: v.rotasCount,
    preco_cliente_medio: v.pcN ? (v.sumPc / v.pcN) : null,
    preco_motorista_medio: v.pmN ? (v.sumPm / v.pmN) : null,
    preco_destino_medio: v.pdN ? (v.sumPd / v.pdN) : null,
  }));

  const clientStats = mapToSortedArr(byClient, (cliente, v) => ({
    cliente,
    obras: v.obras.size,
    rotas: v.rotasCount,
    preco_cliente_medio: v.pcN ? (v.sumPc / v.pcN) : null,
  })).slice(0, 40); // limita no prompt

  return {
    total_obras: OBRAS.length,
    total_rotas: totalRotas,
    por_regiao: regionStats,
    por_tipo: typeStats,
    top_clientes_por_rotas: clientStats
  };
}

function compactObra(o){
  // compacta pra caber no prompt
  const rotas = Array.isArray(o.rotas) ? o.rotas.map(r => ({
    rota: r.rota_nome ?? "",
    destino: r.destino_nome ?? "",
    preco_cliente: r.preco_cliente,
    preco_motorista: r.preco_motorista,
    preco_destino: r.preco_destino,
    volume_type: r.volume_type_raw ?? ""
  })) : [];
  return {
    id_obra: o.id_obra,
    obra_nome: o.obra_nome,
    cliente: o.cliente,
    city: o.city,
    neighborhood: o.neighborhood,
    region: o.region,
    lat: o.lat,
    lng: o.lng,
    volume_type: o.volume_type_raw,
    rotas
  };
}

function buildGeminiPrompt(question){
  // O usuário pediu pra IA "ler todos os dados das obras".
  // Então: manda os dados completos (compactados) + resumos analíticos.
  const allCompact = OBRAS.map(compactObra);
  const analytics = buildAnalytics();

  const meta = {
    ultima_data_base: ULTIMA_DATA_BASE,
    total_obras: OBRAS.length,
    obs: "Os dados abaixo vêm do código do projeto (OBRAS). Use-os para fazer análises (média, mediana, ranking, outliers etc.)."
  };

  const payload = {
    meta,
    analytics,
    obras: allCompact
  };

  const system = [
    "Você é o Alfred 🕵🏼: analítico, direto e bem humano no jeito de explicar.",
    "Responda em português (Brasil).",
    "Seu trabalho é ANALISAR os dados fornecidos (JSON) e responder com raciocínio numérico quando fizer sentido (médias, ranking, dispersão, comparações por região, tipo, cliente, bairro, cidade).",
    "Formato: texto natural, fácil de ler. Pode usar emojis de leve (sem exagerar).",
    "IMPORTANTE: não use Markdown. Não use **, *, ###, tabelas em markdown. Use só frases e quebras de linha.",
    "Se precisar listar, use bullets simples (•) e pronto.",
    "Regra #1: se a pergunta for sobre obras/rotas/preços/região/cliente (ou qualquer coisa que pareça 'dados internos'), use SOMENTE o JSON.",
    "Regra #2: se a pergunta for sobre conhecimento geral (ex.: conceitos de engenharia, normas, boas práticas, explicações), responda com conhecimento geral.",
    "Regra #3: se a pergunta pedir dados externos/atualizados (ex.: 'hoje', 'agora', notícias, normas recentes, preços atuais, clima), use a ferramenta google_search para buscar na web.",
    "Não inclua uma seção de fontes/links como 'Fontes'. Se citar URLs, pode ser no meio do texto e pronto.",
    "Evite frases padrão longas. Seja objetivo e responda direto.",
    "Se você fizer conta, mostre a lógica (bem rapidinho), e cite exemplos (id_obra/obra_nome/cliente/região) quando ajudar."
  ].join("\n");

  return [
    system,
    "",
    "DADOS (JSON):",
    JSON.stringify(payload),
    "",
    "PERGUNTA:",
    question
  ].join("\n");
}

function escapeHtmlToSafeText(s){
  return String(s ?? "").replace(/[&<>"']/g, m => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;" }[m]));
}

// Remove "markdownzice" que o modelo às vezes cospe (**, *, ###, etc.)
function stripMarkdownLoose(text){
  let t = String(text ?? "");
  // títulos ###
  t = t.replace(/^\s{0,3}#{1,6}\s+/gm, "");
  // negrito/itálico
  t = t.replace(/\*\*([^*]+)\*\*/g, "$1");
  t = t.replace(/__([^_]+)__/g, "$1");
  t = t.replace(/\*([^*]+)\*/g, "$1");
  t = t.replace(/_([^_]+)_/g, "$1");
  // inline code
  t = t.replace(/`([^`]+)`/g, "$1");
  // listas com - ou *
  t = t.replace(/^\s*[-*+]\s+/gm, "• ");
  // remove linhas só de *** ou ---
  t = t.replace(/^\s*(\*{3,}|-{3,}|_{3,})\s*$/gm, "");
  return t;
}

function escapeExceptAnchors(textWithAnchors){
  const parts = String(textWithAnchors ?? "").split(/(<a\b[^>]*>[\s\S]*?<\/a>)/gi);
  return parts.map(p => {
    if (/^<a\b/i.test(p)) return p; // já é âncora
    return escapeHtmlToSafeText(p);
  }).join("");
}

function linkifyHtml(safeHtml){
  // Já vem escapado; então só procuramos URLs em texto plano e transformamos em <a>
  // Evita mexer em links que já são <a ...>
  const placeholder = "__A_TAG_PLACEHOLDER__";
  const stash = [];
  let html = String(safeHtml ?? "");
  html = html.replace(/<a\b[^>]*>[\s\S]*?<\/a>/gi, (m) => {
    stash.push(m);
    return placeholder + (stash.length - 1) + "__";
  });

  html = html.replace(/(https?:\/\/[\w\-._~:/?#\[\]@!$&'()*+,;=%]+)(?=[\s<]|$)/g, (m) => {
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

function addCitationsFromGrounding(rawText, groundingMetadata){
  // baseado no padrão da doc oficial (ai.google.dev) para "groundingSupports" e "groundingChunks"
  // retorna { textWithCitationsHtml, sourcesHtml, searchEntryPointHtml }
  let text = rawText ?? "";
  const gm = groundingMetadata;

  const supports = gm?.groundingSupports ?? gm?.grounding_supports ?? [];
  const chunks   = gm?.groundingChunks ?? gm?.grounding_chunks ?? [];
  const entry    = gm?.searchEntryPoint ?? gm?.search_entry_point;

  // normaliza supports -> { endIndex, chunkIndices }
  const normSupports = (supports || []).map(s => {
    const seg = s.segment || s.segment_ || {};
    const endIndex = seg.endIndex ?? seg.end_index;
    const idxs = s.groundingChunkIndices ?? s.grounding_chunk_indices ?? [];
    return { endIndex, idxs };
  }).filter(s => Number.isFinite(s.endIndex) && Array.isArray(s.idxs) && s.idxs.length);

  // insere marcações em ordem decrescente (pra não bagunçar os índices)
  normSupports.sort((a,b) => b.endIndex - a.endIndex);
  for (const s of normSupports){
    const links = s.idxs.map(i => {
      const uri = chunks?.[i]?.web?.uri;
      if (!uri) return null;
      const n = i + 1;
      return `<a href="${escapeHtmlToSafeText(uri)}" target="_blank" rel="noopener noreferrer">[${n}]</a>`;
    }).filter(Boolean);

    if (links.length){
      text = text.slice(0, s.endIndex) + links.join(" ") + text.slice(s.endIndex);
    }
  }

  // lista de fontes (deduplicada)
  const seen = new Set();
  const sources = [];
  for (let i=0; i<(chunks?.length ?? 0); i++){
    const uri = chunks[i]?.web?.uri;
    if (!uri || seen.has(uri)) continue;
    seen.add(uri);
    sources.push({ i: i+1, uri, title: chunks[i]?.web?.title || uri });
  }

  const sourcesHtml = sources.length ? `
    <div class="ai-sources">
      <div class="ai-sources-title">Fontes (Google Search)</div>
      <div class="ai-sources-list">
        ${sources.map(s => `
          <div class="ai-source-item">
            <span class="ai-source-index">[${s.i}]</span>
            <a href="${escapeHtmlToSafeText(s.uri)}" target="_blank" rel="noopener noreferrer">${escapeHtmlToSafeText(s.title)}</a>
          </div>
        `).join("")}
      </div>
    </div>
  ` : "";

  const entryHtml = entry?.renderedContent || entry?.rendered_content || "";

  return {
    // mantém os <a> de citação, mas deixa o resto limpinho (sem ***, etc.)
    textWithCitationsHtml: toOrganicHtml(text, { preserveAnchors: true }),
    sourcesHtml,
    searchEntryPointHtml: entryHtml
  };
}

async function askGemini(question){
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
  const prompt = buildGeminiPrompt(question);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": GEMINI_API_KEY
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: prompt }]
        }
      ],
      // Permite que o Gemini "navegue" via Grounding com Google Search
      tools: [
        { google_search: {} }
      ],
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 900
      }
    })
  });

  if (!res.ok){
    const txt = await res.text().catch(() => "");
    throw new Error(`HTTP ${res.status} — ${txt || "Falha ao chamar a API"}`);
  }

  const data = await res.json();
  const cand = data?.candidates?.[0];
  const text =
    cand?.content?.parts?.map(p => p.text).filter(Boolean).join("") ??
    cand?.content?.parts?.[0]?.text ??
    "";

  const groundingMetadata = cand?.groundingMetadata ?? cand?.grounding_metadata;

  return {
    text: (text || "").trim(),
    groundingMetadata
  };
}

function setAIStatus(html){
  if (!aiAnswerEl) return;
  aiAnswerEl.innerHTML = html;
}

async function onAskAI(){
  const q = (aiQuestionEl?.value ?? "").trim();
  if (!q) {
    setAIStatus('<span class="muted">Digite uma pergunta 🙂</span>');
    return;
  }

  if (aiAskBtn) aiAskBtn.disabled = true;
  setAIStatus('<span class="muted">Pensando… 🤖</span>');

  try {
    const ans = await askGemini(q);
    const txt = ans?.text ?? "";
    // groundingMetadata pode existir quando a IA usa Google Search,
    // mas o usuário pediu pra NÃO mostrar fontes/citações.

    if (!txt){
      setAIStatus('<span class="muted">A API respondeu vazio 😅</span>');
      return;
    }

    const greeting = "Pode deixar que o Alfred 🕵🏼 vai te ajudar";
    const normalized = (txt || "").trim();
    const startsWithGreeting = normalized.toLowerCase().startsWith(greeting.toLowerCase());
    const finalText = startsWithGreeting ? normalized : `${greeting}\n${normalized}`;
    setAIStatus(`<div class="ai-text">${toOrganicHtml(finalText)}</div>`);
  } catch (err) {
    console.error(err);
    const msg = (err && err.message) ? err.message : String(err);
    setAIStatus(`<span class="err">Não rolou chamar o Gemini: ${msg}</span><br/><span class="muted">Se isso for CORS (bloqueio do navegador), a solução é rodar a chamada por um backend/proxy.</span>`);
  } finally {
    if (aiAskBtn) aiAskBtn.disabled = false;
  }
}

aiAskBtn?.addEventListener("click", onAskAI);
aiQuestionEl?.addEventListener("keydown", (e) => {
  if (e.key === "Enter") onAskAI();
});
