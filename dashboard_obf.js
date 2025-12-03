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
        nome: "Dashboard Medição",
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
        nome: "Ranking",
        iframe: `<iframe title="Dashboard - MKT" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNTdjMTY2ZjktZGUxZi00OTIyLTkxYzYtOWIxNmY0NzY3ZmVmIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Crédito de Carbono",
        iframe: `<iframe title="Dashboard - Neutralização" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiMzQxZTU3MTAtYzg0Mi00NzMyLTlkY2EtOTNkNGJlM2NmZTBmIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
      },
      {
        nome: "Remarketing",
        iframe: `<iframe title="Remarketing" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNTZmMTRmYTAtN2RlZi00NWY2LWE1NjUtMGU1ZTIxODFiMTQxIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>`
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

  
  

function getIcon(dep) {
  const map = {
    "Finanças": `<span class="material-symbols-outlined">payments</span>`,
    "Comercial": `<span class="material-symbols-outlined">trending_up</span>`,
    "Marketing": `<span class="material-symbols-outlined">campaign</span>`,
    "Log Terra": `<span class="material-symbols-outlined">front_loader</span>`,
    "Log Fretes": `<span class="material-symbols-outlined">local_shipping</span>`,
    "CS": `<span class="material-symbols-outlined">handshake</span>`,
    "Reta Final": `<span class="material-symbols-outlined">handshake</span>`
  };
  return map[dep] || "";
}


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
      btn.innerHTML = `${getIcon(dep)} ${dep}`;

      btn.onclick = () => {
        dashArea.innerHTML = `<h3>${dep}</h3>`;

        fonte[dep].forEach(d => {
          const b = document.createElement("a");
          b.className = "nav-item";
          b.innerHTML=(function(){if(d.nome=="Dashboard Medição") return `<span class="material-symbols-outlined">square_foot</span> Dashboard Medição `;
            if(d.nome=="Auditoria Fretes") return `<span class="material-symbols-outlined">fact_check</span> Auditoria Fretes `;
            if(d.nome=="Auditoria Modal") return `<span class="material-symbols-outlined">alt_route</span> Auditoria Modal`;
            if(d.nome=="Forecast") return `<span class="material-symbols-outlined">trending_up</span> Forecast`;
            if(d.nome=="DRE") return `<span class="material-symbols-outlined">dashboard</span> DRE`;
            if(d.nome=="Omie") return `<span class="material-symbols-outlined">square_foot</span> Omie`;
            if(d.nome=="Reta Final") return `<span class="material-symbols-outlined">star</span> Reta Final`;
            if(d.nome=="Lista de Motoristas") return `<span class="material-symbols-outlined">local_shipping</span> Lista de motoristas`;
            if(d.nome=="Key Accont") return `<span class="material-symbols-outlined">crown</span> Key Accont`;
            if(d.nome=="CSI 2.0") return `<span class="material-symbols-outlined">feature_search</span> CSI 2.0`;
            if(d.nome=="Gerencial") return `<span class="material-symbols-outlined">gite</span> Gerencial`;
            if(d.nome=="S&OP") return `<span class="material-symbols-outlined">calendar_month</span> S&OP`;
            if(d.nome=="Dashboard - Terra") return `<span class="material-symbols-outlined">front_loader</span> Dashboard - Terra`;
            if(d.nome=="Remarketing") return `<span class="material-symbols-outlined">digital_out_of_home</span> Remarketing`;
            if(d.nome=="Crédito de Carbono") return `<span class="material-symbols-outlined">eco</span> Crédito de Carbono`;
            if(d.nome=="Ranking") return `<span class="material-symbols-outlined">social_leaderboard</span> Ranking`;
            return d.nome;})();

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
