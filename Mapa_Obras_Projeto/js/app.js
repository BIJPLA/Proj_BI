
const map=L.map('map').setView([-23.55,-46.63],12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

// Placeholder: lógica completa já validada nas versões anteriores
let obras=[];
let markers=[];

function render(lista){
  markers.forEach(m=>map.removeLayer(m));
  markers=[];
  lista.forEach(o=>{
    markers.push(L.marker([o.lat,o.lng]).addTo(map).bindPopup(o.obra));
  });
}

function filtrar(){ render(obras); }
function limpar(){ render(obras); }

render(obras);
