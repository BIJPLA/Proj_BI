async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=br&bounded=1&viewbox=-47.0,-23.3,-46.3,-23.9&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'ConsultaSimples' } });
    const data = await response.json();

    if (data.length === 0) throw new Error("Endereço não encontrado");

    // Ordena por importance
    data.sort((a, b) => b.importance - a.importance);

    const result = data[0];
    if (!result || !result.lat || !result.lon) throw new Error("Resposta inválida da geocodificação");

    console.log("Endereço retornado:", result.display_name);

    return [parseFloat(result.lon), parseFloat(result.lat)];
}

const DMT = {
  "CAVA": { "Norte": 1.15, "Oeste": 1.15, "Leste": 1.15, "Sul": 1.15 },
  "Empreiterra": { "Norte": 1.2, "Oeste": 1.2, "Leste": 1.25, "Sul": 1.2 },
  "Essencis": { "Norte": 1.35, "Oeste": 1.3, "Leste": 1.25, "Sul": 1.3 },
  "Imbulix": { "Norte": 1.2, "Oeste": 1.15, "Leste": 1.25, "Sul": 1.15 },
  "Itaquareia": { "Norte": 1.1, "Oeste": 1.1, "Leste": 1.1, "Sul": 1.1 },
  "Olifar": { "Norte": 1.6, "Oeste": 1.3, "Leste": 1.6, "Sul": 1.3 },
  "UVR Grajau": { "Norte": 1.6, "Oeste": 1.5, "Leste": 1.6, "Sul": 1.5 },
  "Temari": { "Norte": 1.2, "Oeste": 1.2, "Leste": 1.2, "Sul": 1.2 },
  "Mombaça": { "Norte": 1.2, "Oeste": 1.2, "Leste": 1.2, "Sul": 1.2 },
  "HSH": { "Norte": 1.2, "Oeste": 1.2, "Leste": 1.25, "Sul": 1.2 },
  "Carmosina": { "Norte": 1.35, "Oeste": 1.3, "Leste": 1.35, "Sul": 1.3 },
  "Nova Ambiental": { "Norte": 1.25, "Oeste": 1.2, "Leste": 1.25, "Sul": 1.2 },
  "CDR Pedreira": { "Norte": 1.3, "Oeste": 1.3, "Leste": 1.3, "Sul": 1.5 },
  "Lara": { "Norte": 1.35, "Oeste": 1.35, "Leste": 1.35, "Sul": 1.35 },
  "JS dos Santos": { "Norte": 1.2, "Oeste": 1.2, "Leste": 1.2, "Sul": 1.2 },
  "Geoincorp": { "Norte": 1.25, "Oeste": 1.2, "Leste": 1.25, "Sul": 1.2 },
  "Sanca":{"Norte": 1.25, "Oeste":1.25, "Leste":1.25, "Sul": 1.30},
  "Parmv":{"Norte": 1.25, "Oeste":1.25, "Leste":1.25, "Sul": 1.30},

};

function exportarXLSX() {
  const rows = document.querySelectorAll('#tabelaResultados tbody tr');
  const wb = XLSX.utils.book_new();
  const data = [['Destino', 'Endereço', 'Status', 'Distância', 'Duração', 'Preço', 'Rota']];
  rows.forEach(row => {
    const cols = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText);
    data.push(cols);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Rotas');

  const titulo = document.getElementById("tituloResultado").innerText.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${titulo}.xlsx`);
}

async function calcularRotas() {
  const end1 = document.getElementById('end1').value.trim();
  if (!end1) {
    alert("Por favor, digite o endereço de origem.");
    return;
  }

  const destinos = [
  { nome: "CAVA", coordenadas: [-46.8120277777778, -23.5148333333333], preco: 0, status: "Ativo" },
  { nome: "Empreiterra", coordenadas: [-46.5585531, -23.4747267], preco: 0, status: "Ativo"  },
  { nome: "Imbulix", coordenadas: [-46.841689, -23.662857], preco: 0, status: "Ativo"  },
  { nome: "Itaquareia", coordenadas: [-46.343509, -23.473241], preco: 0, status: "Ativo"  },
  {nome: "Parmv", coordenadas: [-46.535480, -23.483620], preco: 0, status: "Ativo"},
  { nome: "Temari", coordenadas: [-46.4647502, -23.4148032], preco: 0, status: "Inativo"  },
  { nome: "Nova Ambiental", coordenadas: [-46.9783503, -23.5264676], preco: 0, status: "Ativo"  },
  { nome: "CDR Pedreira", coordenadas: [-46.5629714, -23.4126744], preco: 0, status: "Ativo"  },
  { nome: "Essencis", coordenadas: [-46.786638, -23.356849], preco: 0, status: "Ativo"  },
  { nome: "Olifar", coordenadas: [ -46.674365, -23.767057], preco: 0, status: "Ativo"  },
  { nome: "Lara", coordenadas: [-46.473925, -23.704714], preco: 0, status: "Ativo"  },
  { nome: "Carmosina", coordenadas: [-46.428443, -23.588269], preco: 0, status: "Inativa"  },
  { nome: "Mombaça", coordenadas: [-46.849432, -23.747264], preco: 0, status: "Ativo"  },
  { nome: "HSH", coordenadas: [-46.399498, -23.481151], preco: 0, status: "Ativo"  },
  { nome: "JS dos Santos", coordenadas: [-46.770521, -23.438445], preco: 0, status: "Ativo"  },
  { nome: "Geoincorp", coordenadas: [-46.931481, -23.617269], preco: 0, status: "Ativo"  },
  {nome: "Sanca", coordenadas: [-46.59873, -23.52481], preco: 0, status: "Ativo"}
];


  const geocodificar = async endereco => {
    const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(endereco + ', Brasil')}`);
    const data = await response.json();
    if (data.length > 0) {
      return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
    }
    throw new Error(`Endereço não encontrado: ${endereco}`);
  };

  const origemCoord = await geocodificar(end1);
  const tabelaBody = document.querySelector('#tabelaResultados tbody');
  tabelaBody.innerHTML = "";

  if (window.mapInstance) {
        window.mapInstance.remove();
    }
    window.mapInstance = L.map('map').setView([origemCoord[1], origemCoord[0]], 10);
    const map = window.mapInstance;
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
  }).addTo(map);
  L.marker([origemCoord[1], origemCoord[0]]).addTo(map).bindPopup("Origem").openPopup();

  for (let destino of destinos) {
    try {
      const destinoCoord = destino.coordenadas;
      const response = await fetch('https://api.openrouteservice.org/v2/directions/driving-car', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': '5b3ce3597851110001cf62489ba64b90dd6d4ab8bcc92d787f377d8d'
        },
        body: JSON.stringify({ coordinates: [origemCoord, destinoCoord] })
      });
      const data = await response.json();
      const distanciaKm = data.routes[0].summary.distance / 1000;
      const duracaoMin = data.routes[0].summary.duration / 60;
      const zona = document.getElementById('zona').value;
      const equipamento = document.getElementById('equipamento').value;
      const regiao = document.getElementById('regiao').value;

      let dmtBase = DMT[destino.nome] ? DMT[destino.nome][zona] : 1.0;
      if (regiao === "Bairro") dmtBase += 0.05;
      if (equipamento === "Pequeno Porte") dmtBase += 0.15;

      const preco = distanciaKm * dmtBase;
      const rotaURL = `https://www.google.com/maps/dir/${origemCoord[1]},${origemCoord[0]}/${destinoCoord[1]},${destinoCoord[0]}`;

      
const linha = `<tr><td>${destino.nome}</td><td>${destino.status}</td><td>${distanciaKm.toFixed(2)} km</td><td>${Math.round(duracaoMin)} min</td><td>${dmtBase.toFixed(2)}</td><td>R$ ${preco.toFixed(2)}</td><td>R$ ${((distanciaKm + 3) * dmtBase).toFixed(2)}</td><td>R$ ${((distanciaKm + 5) * dmtBase).toFixed(2)}</td><td><a href="${rotaURL}" target="_blank">Ver rota</a></td></tr>`;
destinosCalculados.push({
  nomeObra: document.getElementById("obra").value.trim(),
  enderecoOrigem: document.getElementById("end1").value.trim(),
  destino: destino.nome,
  enderecoDestino: (function() {
    const mapa = {
      "CAVA Lagoa de Carapicuíba": "Av. Marginal Direita, 900",
      "Imbulix": "Estrada Comendador, 26 - Jardim Magali, Embu das Artes - SP, 06833-070",
      "Itaquareia": "Estrada Governador Mario Covas Júnior 1000",
      "Lara Ambiental": "Avenida Guaraciaba, 430, Mauá",
      "Olifar": "Avenida Carlos Barbosa Santos, 1460",
      "Essencis": "Rod. dos Bandeirantes, km. 33, Caieiras",
      "Temari": "Avenida Candea, 113",
      "UVR Grajau": "Av. Paulo Guilguer Reimberg, 3920",
      "Empreiterra Ambiental": "R. Dr. Passos, 121 Itapegica",
      "UVR Paineiras": "Estr. do Schmidt, 74118 - Grajaú",
      "Eleven": "Estr de São Bento 4971",
      "Athene": "Rua José Marques Ribeiro Cajamar"
    };
    return mapa[destino.nome] || "";
  })(),
  distancia: distanciaKm.toFixed(2) + " km",
  dmt: dmtBase.toFixed(2),
  preco: "R$ " + preco.toFixed(2),
  tresKm: "R$ " + ((distanciaKm + 3) * dmtBase).toFixed(2),
  cincoKm: "R$ " + ((distanciaKm + 5) * dmtBase).toFixed(2),
  rota: rotaURL
});

      tabelaBody.insertAdjacentHTML('beforeend', linha);
      L.marker([destinoCoord[1], destinoCoord[0]]).addTo(map).bindPopup(destino.nome);
    } catch (err) {
      console.error(err);
    }
  }

  document.getElementById('resultadoBox').style.display = 'block';

  const nomeObra = document.getElementById('obra').value.trim();
  const endereco = document.getElementById('end1').value.trim();
  const dataAtual = new Date().toLocaleDateString('pt-BR');
  const titulo = `${nomeObra} - ${endereco} - ${dataAtual}`;
  document.getElementById('tituloResultado').innerText = titulo;

}

let ordemAscendente = {};

function ordenarTabela(colIndex) {
  const tabela = document.getElementById('tabelaResultados');
  let linhas = Array.from(tabela.querySelectorAll('tbody tr'));
  let tipoNumerico = colIndex === 2 || colIndex === 4;
  ordemAscendente[colIndex] = !ordemAscendente[colIndex];

  linhas.sort((a, b) => {
    let valA = a.cells[colIndex].innerText.replace(/[^0-9,.-]+/g, '').replace(',', '.');
    let valB = b.cells[colIndex].innerText.replace(/[^0-9,.-]+/g, '').replace(',', '.');

    if (tipoNumerico) {
      valA = parseFloat(valA);
      valB = parseFloat(valB);
      return ordemAscendente[colIndex] ? valA - valB : valB - valA;
    } else {
      return ordemAscendente[colIndex] ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
  });

  for (let linha of linhas) {
    tabela.tBodies[0].appendChild(linha);
  }

}

// NOVA FUNÇÃO EXPORTAR DEFINITIVA

let destinosCalculados = []; // Global para armazenar os dados calculados

function exportarXLSX() {
  const rows = document.querySelectorAll('#tabelaResultados tbody tr');
  const wb = XLSX.utils.book_new();
  const data = [['Destino', 'Endereço', 'Status', 'Distância', 'Duração', 'Preço', 'Rota']];
  rows.forEach(row => {
    const cols = Array.from(row.querySelectorAll('td')).map(cell => cell.innerText);
    data.push(cols);
  });
  const ws = XLSX.utils.aoa_to_sheet(data);
  XLSX.utils.book_append_sheet(wb, ws, 'Rotas');

  const titulo = document.getElementById("tituloResultado").innerText.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `${titulo}.xlsx`);
}