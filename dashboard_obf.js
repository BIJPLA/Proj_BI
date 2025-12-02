(function () {
  const URL_PERMISSOES = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTJKMi1lL6q1brQg2E8CN11-mNtMfdlM9AocetE3NrWbjJhG2uyTdclMXTbOu7Nq7hWtAWcKd31cwTr/pub?gid=1579622232&single=true&output=csv";

  // ======== Funções auxiliares ========

  function _extractSrc(html) {
    const m = html.match(/src\s*=\s*['"]([^'"]+)['"]/i);
    return m ? m[1] : null;
  }

  function _swapIframe(container, html) {
    const newSrc = _extractSrc(html);
    const existing = container.querySelector("iframe");

    if (existing && newSrc) {
      if (existing.getAttribute("src") !== newSrc) {
        existing.setAttribute("src", newSrc);
      }
      return existing;
    }

    container.insertAdjacentHTML("beforeend", html);
    return container.querySelector("iframe");
  }

  // ======== Tabela fixa de dashboards ========

  const permissoesBase = {
    "Finanças": [
      {
        nome: " 💵 Dashboard Medição",
        iframe: `<iframe title="Dashboard - OMIE" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNTAxZjk5YmEtODRhMy00ZWZkLWE2NjktNzNhZWE3YWMxYjBiIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Auditoria Fretes",
        iframe: `<iframe title="Auditoria - Fretes" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiZWViODNkNmQtNTBiZC00YTFlLWE0NTYtNjkzOWU1M2IzMWFlIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Auditoria Modal",
        iframe: `<iframe title="Auditória - Modal" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiMjhkNWQ1MmYtNmVkMS00MzlmLTk0ZWMtYjc4YTVjMzg3YjFjIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Forecast",
        iframe: `<iframe title="Forecast" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYjI3NGY1YmMtMDdlMy00ZjNlLTkxODUtZTk2MWNmMDE2ZTY3IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "DRE",
        iframe: `<iframe title="DRE - BI" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiN2M0MzFlYWYtNjEzNy00OWJjLWFmNDMtY2UwM2I3ZGYzOTRhIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      }
    ],

    "Comercial": [
      { nome: "Gerencial", iframe: '<iframe title="Dash_Gerencial_2.0" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiZTMzZTdlOGUtY2UxOC00MTY0LTgzNDItNzRhODNmZmMyOTZlIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'},
    { nome: "Key Accont", iframe: '<iframe title="Dash_Keyaccount" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYzk0MWNhZDctZjQ4Yi00MGQ3LTk2NzItZmY5MmFhZDI0YjE0IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>' },
    { nome: "CSI 2.0", iframe: '<iframe title="CSI - 2.0" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiZjViMWYwODgtYzNjZC00NWI2LWEwNjgtYTlkMzRiMDA4N2E4IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>' },
  ],

    "Log Fretes": [
      {
        nome: "Lista de Motoristas",
        iframe: `<iframe title="Lista de Motoristas - Fretes" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiY2M4YzAzZjYtOGIxOS00YmRhLWEyYmEtZjdiOGRlMjhmYjMxIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      }
    ],

    "Log Terra": [
      {
        nome: "Dashboard - Terra",
        iframe: `<iframe title="Lista de Motoristas - Terra" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYzhhOGMyMmYtZGZhNS00MzkwLWI4MTItMjU3MzZjZmM2MzZiIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "S&OP",
        iframe: `<iframe title="S&OP 2.0 - Landapp" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYzZhZjlhYWYtODhkZC00NjY3LWE3MTMtZmY2NTY0YzQ1ODU1IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Omie",
        iframe: `<iframe title="Dashboard - Medicao" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNmEyMGIyNzctZGM3Yi00ZjAxLWJiMWUtOTRjYTA2NDk5ZTdmIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      }
    ],

    "Marketing": [
      {
        nome: "Remarketing",
        iframe: `<iframe title="Remarketing" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNTZmMTRmYTAtN2RlZi00NWY2LWE1NjUtMGU1ZTIxODFiMTQxIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Crédito de Carbono",
        iframe: `<iframe title="Dashboard - Neutralização" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiMzQxZTU3MTAtYzg0Mi00NzMyLTlkY2EtOTNkNGJlM2NmZTBmIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      }
    ],
    "Reta Final": [
            {
        nome: "Reta Final",
        iframe: `<iframe title="Reta Final - 2025" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiMmU1MDRlODUtYmQxMi00Y2NhLTgzZTQtMmEyOTI3N2VlZTAyIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      }
    ]
  };

  // Normalizar slug
  function _slugDepto(txt) {
    return txt
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
  }

  // Map slug -> nome original
  const _mapaDepartamentos = {};
  for (const dep in permissoesBase) {
    if (Object.prototype.hasOwnProperty.call(permissoesBase, dep)) {
      _mapaDepartamentos[_slugDepto(dep)] = dep;
    }
  }

  function _normalizarDepartamento(raw) {
    const slug = _slugDepto(raw || "");
    return _mapaDepartamentos[slug] || null;
  }

  // ========= Buscar permissões no Google Sheets =========

  async function _carregarPermissoesUsuario(email) {
    try {
      const resp = await fetch(URL_PERMISSOES);
      if (!resp.ok) return null;

      const csv = await resp.text();
      const linhas = csv.split(/\r?\n/).map(l => l.split(","));
      if (!linhas.length) return null;

      const [header, ...rows] = linhas;

      const idxEmail = header.findIndex(h => h.trim().toLowerCase() === "email" || h.trim().toLowerCase() === "e-mail");
      const idxDash = header.findIndex(h => h.trim().toLowerCase() === "dashboard");

      if (idxEmail === -1 || idxDash === -1) return null;

      const linha = rows.find(r => (r[idxEmail] || "").trim().toLowerCase() === email.toLowerCase());
      if (!linha) return null;

      const regraBruta = (linha[idxDash] || "").trim().toLowerCase();
      if (!regraBruta) return null;

      if (regraBruta === "todos") return permissoesBase;

      const resultado = {};
      const tokens = regraBruta.split("|").map(p => p.trim()).filter(Boolean);

      tokens.forEach(token => {
        let depToken = token;

        if (depToken.includes("/")) depToken = depToken.split("/")[0];

        const nomeDepto = _normalizarDepartamento(depToken);
        if (nomeDepto && permissoesBase[nomeDepto]) {
          resultado[nomeDepto] = permissoesBase[nomeDepto];
        }
      });

      if (!Object.keys(resultado).length) return {};

      return resultado;
    } catch (e) {
      console.error("Erro ao carregar permissões:", e);
      return null;
    }
  }

  // ========= UI =========

  const container = document.getElementById("departamentos");
  const dashArea = document.getElementById("dashboards");

  function montarDepartamentos() {
    if (!container || !dashArea) return;

    container.innerHTML = "";
    dashArea.innerHTML = "";

    const fonte = window.permissoesAtuais || {};

    for (let dep in fonte) {
      if (!Object.prototype.hasOwnProperty.call(fonte, dep)) continue;

      const btn = document.createElement("a");
      btn.className = "nav-item";
      btn.innerHTML = `<i class="fas fa-chart-bar"></i> ${dep}`;

      btn.onclick = () => {
        dashArea.innerHTML = `<h3>${dep}</h3>`;

        fonte[dep].forEach(d => {
          const b = document.createElement("a");
          b.className = "nav-item";
          b.textContent = d.nome;

          b.onclick = () => {
            const frames = dashArea.querySelectorAll("iframe");
            frames.forEach((f, i) => { if (i !== 0) f.remove(); });
            _swapIframe(dashArea, d.iframe);
          };

          dashArea.appendChild(b);
        });
      };

      container.appendChild(btn);
    }
  }

  
// ========= Carregar permissões controlado pelo script de login =========

document.addEventListener("DOMContentLoaded", () => {
  // fluxo controlado em script.js
});

// Exporta funções para uso no script de login
window._carregarPermissoesUsuario = _carregarPermissoesUsuario;
window._montarDepartamentosDashboard = montarDepartamentos;

})();
