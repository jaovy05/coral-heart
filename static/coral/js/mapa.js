let map;
let geojsonGroup;
let telemetryGroup;

document.addEventListener('DOMContentLoaded', () => {
    map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false,
        minZoom: 2,
        maxZoom: 14,
        renderer: L.canvas()
    }).setView([-12.0, -42.0], 4);

    L.control.scale({
        metric: true,
        imperial: false,
        position: 'bottomleft'
    }).addTo(map);

    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    geojsonGroup = L.featureGroup().addTo(map);
    telemetryGroup = L.featureGroup().addTo(map);

    if (typeof HeatmapModule !== 'undefined') {
        HeatmapModule.init(map);
    }

    renderizarRegioes();
    carregarDadosEHeatmap();
});
