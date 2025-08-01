const permissoes = {
  "Finanças": [
    { nome: "Dashboard Medição", iframe: `<iframe title="Dashboard - OMIE" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNTAxZjk5YmEtODRhMy00ZWZkLWE2NjktNzNhZWE3YWMxYjBiIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'` },
    {nome: "Auditoria Fretes", iframe: '<iframe title="Auditoria - Fretes" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiZWViODNkNmQtNTBiZC00YTFlLWE0NTYtNjkzOWU1M2IzMWFlIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'},
    {nome: "Auditoria Modal", iframe: '<iframe title="Auditória - Modal" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiMjhkNWQ1MmYtNmVkMS00MzlmLTk0ZWMtYjc4YTVjMzg3YjFjIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'},
    {nome: "Forecast", iframe: '<iframe title="Forecast" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYjI3NGY1YmMtMDdlMy00ZjNlLTkxODUtZTk2MWNmMDE2ZTY3IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'},
    {nome: "DRE", iframe: '<iframe title="DRE - BI" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiN2M0MzFlYWYtNjEzNy00OWJjLWFmNDMtY2UwM2I3ZGYzOTRhIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'},
  
  ],
  "Comercial": [
    { nome: "Gerencial", iframe: '<iframe title="Dash_Gerencial_2.0" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiZTMzZTdlOGUtY2UxOC00MTY0LTgzNDItNzRhODNmZmMyOTZlIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'},
    { nome: "Key Accont", iframe: '<iframe title="Dash_Keyaccount" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYzk0MWNhZDctZjQ4Yi00MGQ3LTk2NzItZmY5MmFhZDI0YjE0IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>' },
  ],
  "Log Fretes": [
    { nome: "Lista de Motoristas", iframe: `<iframe src='https://app.powerbi.com/view?r=eyJrIjoiY2M4YzAzZjYtOGIxOS00YmRhLWEyYmEtZjdiOGRlMjhmYjMxIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9' allowfullscreen></iframe>` }
  ],
  "Log Terra": [
  { nome: "Dahsboard - Caçambas", iframe: '<iframe title="Lista de Motoristas - Terra" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYjE4NGViNzQtNmNiNS00NTk3LWE5NzUtYzVkY2IwYTc5OWI0IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'}
  ],
  "CS": [
    {nome: "Planejamento", inframe: '<iframe title="Planejamento - Landapp" width="1140" height="541.25" src="https://app.powerbi.com/reportEmbed?reportId=1301a2cd-5009-49d6-8fe5-89b506ce22d1&autoAuth=true&ctid=b7567895-10cc-49be-9241-37e572266fef" frameborder="0" allowFullScreen="true"></iframe>'},
  ],
  "Marketing": []
};

const container = document.getElementById("departamentos");
const dashArea = document.getElementById("dashboards");

for (let depto in permissoes) {
  const btn = document.createElement("a");
  btn.className = "nav-item";
  btn.innerHTML = `<i class="fas fa-chart-bar"></i> ${depto}`;
  btn.onclick = () => {
    dashArea.innerHTML = `<h3>${depto}</h3>`;
    permissoes[depto].forEach(d => {
      const b = document.createElement("a");
      b.className = "nav-item";
      b.textContent = d.nome;
      b.onclick = () => {
        dashArea.innerHTML += d.iframe;
      };
      dashArea.appendChild(b);
    });
  };
  container.appendChild(btn);
}
