const permissoes = {
  "Finanças": [
    { nome: "Dashboard Medição", iframe: `<iframe title="Dashboard - OMIE" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiNTAxZjk5YmEtODRhMy00ZWZkLWE2NjktNzNhZWE3YWMxYjBiIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>me src='https://app.powerbi.com/view?r=eyJrIjoiNmEyMGIyNzctZGM3Yi00ZjAxLWJiMWUtOTRjYTA2NDk5ZTdmIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9' allowfullscreen></iframe>` }
  ],
  "Comercial": [
    { nome: "Calculadora", iframe: "<iframe src='#'></iframe>" },
    { nome: "Leads", iframe: "<iframe src='#'></iframe>" }
  ],
  "Log Fretes": [
    { nome: "Lista de Motoristas", iframe: `<iframe src='https://app.powerbi.com/view?r=eyJrIjoiY2M4YzAzZjYtOGIxOS00YmRhLWEyYmEtZjdiOGRlMjhmYjMxIiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9' allowfullscreen></iframe>` }
  ],
  "Log Terra": [
  { nome: "Dahsboard - Caçambas", iframe: '<iframe title="Lista de Motoristas - Terra" width="600" height="373.5" src="https://app.powerbi.com/view?r=eyJrIjoiYjE4NGViNzQtNmNiNS00NTk3LWE5NzUtYzVkY2IwYTc5OWI0IiwidCI6ImI3NTY3ODk1LTEwY2MtNDliZS05MjQxLTM3ZTU3MjI2NmZlZiJ9" frameborder="0" allowFullScreen="true"></iframe>'}
  ],
  "CS": [],
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
