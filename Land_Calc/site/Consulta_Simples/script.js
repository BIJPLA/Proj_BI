
// Inicializar o mapa
let map = L.map('map').setView([-23.55052, -46.633308], 12);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors'
}).addTo(map);

let routeLayer = null;

function calcularValorAterroZero(km) {
    let fator = 0;
    if (km <= 6) {
        return { preco: 12.00, dmt: "12.00" };
    } else if (km <= 10) {
        fator = 1.75;
    } else if (km <= 15) {
        fator = 1.70;
    } else if (km <= 20) {
        fator = 1.65;
    } else if (km <= 25) {
        fator = 1.60;
    } else if (km <= 30) {
        fator = 1.55;
    } else if (km <= 35) {
        fator = 1.50;
    } else if (km <= 40) {
        fator = 1.45;
    } else {
        return { preco: 0, dmt: "0" };
    }
    return { preco: km * fator, dmt: fator.toFixed(2) };
}

async function geocode(address) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`;
    const response = await fetch(url, { headers: { 'User-Agent': 'ConsultaSimples' } });
    const data = await response.json();
    if (data.length === 0) throw new Error("Endereço não encontrado");
    return [parseFloat(data[0].lon), parseFloat(data[0].lat)];
}

async function calcularRota() {
    const nomeOrigem = document.getElementById("nomeOrigem").value;
    const nomeDestino = document.getElementById("nomeDestino").value;
    const enderecoOrigem = document.getElementById("enderecoOrigem").value;
    const enderecoDestino = document.getElementById("enderecoDestino").value;

    if (!enderecoOrigem || !enderecoDestino) {
        alert("Por favor, preencha ambos os endereços.");
        return;
    }

    try {
        const [origCoord, destCoord] = await Promise.all([
            geocode(enderecoOrigem),
            geocode(enderecoDestino)
        ]);

        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${origCoord[0]},${origCoord[1]};${destCoord[0]},${destCoord[1]}?overview=full&geometries=geojson`);

        if (!response.ok) {
            alert("Erro ao consultar rota.");
            return;
        }

        const data = await response.json();
        if (data.routes.length === 0) {
            alert("Nenhuma rota encontrada.");
            return;
        }

        const route = data.routes[0];
        const distanceKm = route.distance / 1000;
        const durationMin = route.duration / 60;

        const calc = calcularValorAterroZero(distanceKm);
        const preco = calc.preco;
        const dmt = calc.dmt;

        document.getElementById("resultado").innerHTML = `
            <table id="resultadoTabela" border="1" cellpadding="8" style="border-collapse: collapse; width: 100%; margin-top:15px;">
                <tr style="background-color:#f0f0f0;">
                    <th>Origem</th>
                    <th class='sticky-col'>Destino</th>
                    <th>Distância (km)</th>
                    <th>Tempo (min)</th>
                    <th>DMT</th>
                    <th>Preço (R$)</th>
                </tr>
                <tr>
                    <td>${nomeOrigem || "-"}</td>
                    <td class='sticky-col'>${nomeDestino || "-"}</td>
                    <td>${distanceKm.toFixed(2)}</td>
                    <td>${durationMin.toFixed(1)}</td>
                    <td>${dmt}</td>
                    <td>${preco.toFixed(2)}</td>
                </tr>
            </table>
        `;

        if (routeLayer) {
            map.removeLayer(routeLayer);
        }
        routeLayer = L.geoJSON(route.geometry).addTo(map);
        map.fitBounds(routeLayer.getBounds());
    } catch (error) {
        alert("Erro: " + error.message);
    }
}

function exportarXLSX() {
    const tabela = document.querySelector("#resultado table");
    if (!tabela) {
        alert("Nenhum resultado para exportar.");
        return;
    }
    const nomeOrigem = document.getElementById("nomeOrigem").value || "Origem";
    const nomeDestino = document.getElementById("nomeDestino").value || "Destino";
    const wb = XLSX.utils.table_to_book(tabela, { sheet: "Consulta" });
    XLSX.writeFile(wb, nomeOrigem + " x " + nomeDestino + ".xlsx");
}

function exportarPDF() {
    const nomeOrigem = document.getElementById("nomeOrigem").value || "Origem";
    const nomeDestino = document.getElementById("nomeDestino").value || "Destino";
    const dataConsulta = new Date().toLocaleDateString();
    const doc = new jspdf.jsPDF();

    // Cabeçalho colorido
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFillColor("#f15500");
    doc.rect(0, 0, pageWidth, 20, "F");
    doc.setTextColor(255);
    doc.setFontSize(12);
    doc.text(nomeOrigem + " - " + nomeDestino + " - " + dataConsulta, pageWidth / 2, 13, { align: "center" });

    // Tabela
    doc.autoTable({
        html: '#resultadoTabela',
        startY: 25,
        headStyles: { fillColor: [241, 85, 0], textColor: 255 },
        styles: { halign: 'center' }
    });

    doc.save(nomeOrigem + " x " + nomeDestino + ".pdf");
}
