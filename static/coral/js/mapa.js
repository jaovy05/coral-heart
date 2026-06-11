
let map;
let geojsonGroup;

document.addEventListener('DOMContentLoaded', () => {
            
    // 1. Inicialização do Mapa Científico
    map = L.map('map-container', {
        zoomControl: false,
        attributionControl: false,
        minZoom: 2,
        maxZoom: 14,
        renderer: L.canvas(), 
    }).setView([-25.5, -45.5], 6);

    // 2. Adicionar Escala Gráfica
    L.control.scale({
        metric: true,
        imperial: false,
        position: 'bottomleft'
    }).addTo(map);

    // 3. Adicionar Controle de Zoom no Canto Inferior Direito
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);

    // 4. Camada de mapa limpa (Sem rótulos para focar apenas nas áreas marinhas)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);

    // Grupo para guardar todos os polígonos e permitir focar a câmera neles depois
    geojsonGroup = L.featureGroup().addTo(map);

    // 5. Captura dos Dados do Django e Plotagem
    renderizarRegioes();
});


 /**
 * Renderiza os MultiPolygons no mapa com a estética Oceanic UI
 */
function renderizarRegioes() {
    try {
        const rawData = document.getElementById('recifes-data').textContent;
        const regioes = JSON.parse(rawData);

        
        let totalRegioes = 0;
        console.log("Dados de Regiões Recebidos do Django:", regioes);
        regioes.forEach(regiao => {
            let geojsonFeature;
            console.log(`Processando região: ${regiao.pais} - Tipo de coordenadas: ${typeof regiao.coordenadas}`);
            console.log("Coordenadas brutas:", regiao.coordenadas);

            // Caso A: Se os dados já vierem como objeto GeoJSON estruturado do DuckDB
            if (typeof regiao.coordenadas === 'object') {
                geojsonFeature = {
                    "type": "Feature",
                    "properties": {
                        "pais": regiao.pais
                    },
                    "geometry": regiao.coordenadas
                };
            } 
            // Caso B: Se vier como string de texto WKT (ex: "MULTIPOLYGON (((...)))")
            else if (typeof regiao.coordenadas === 'string' && regiao.coordenadas.startsWith('MULTIPOLYGON')) {
                geojsonFeature = parseWKTToGeoJSON(regiao.coordenadas, regiao.pais);
            }

            if (geojsonFeature) {
                // Estética de Águas Rasas e Recifes de Corais (Oceanic UI)
                const layer = L.geoJSON(geojsonFeature, {
                    style: {
                        color: 'var(--water-accent)',    // Linha de contorno (Azul profundo)
                        weight: 2.5,                     // Espessura sutil da borda
                        opacity: 0.85,                   
                        fillColor: '#00b4d8',            // Preenchimento (Ciano translúcido)
                        fillOpacity: 0.25,               // Transparência suave
                        lineJoin: 'round'
                    }
                });

                // Eventos de Hover Orgânicos (Efeito de fluido ao passar o mouse)
                layer.on({
                    mouseover: (e) => {
                        const currentLayer = e.target;
                        currentLayer.setStyle({
                            fillColor: 'var(--coral-action)', // Muda para tom coral pêssego ao focar
                            fillOpacity: 0.45,
                            weight: 3
                        });
                    },
                    mouseout: (e) => {
                        layer.resetStyle(e.target);
                    }
                });

                // Popup informativo do cientista
                layer.bindPopup(`
                    <div style="color: var(--text-main); font-family: system-ui; font-size: 13px; padding: 4px;">
                        <strong style="color: var(--water-accent); font-size: 14px;">Região Oceanográfica</strong><br>
                        <span style="font-weight: 600;">pais:</span> ${regiao.pais}<br>
                        <span style="font-weight: 600;">Tipo de Monitoração:</span> Área Marinha Protegida
                    </div>
                `);

                geojsonGroup.addLayer(layer);
                totalRegioes++;
            }
        });

        // Foca a câmera automaticamente se houver regiões plotadas
        if (totalRegioes > 0) {
            map.fitBounds(geojsonGroup.getBounds(), { padding: [30, 30] });
        }

    } catch (error) {
        console.error("Erro ao ler dados espaciais do Django:", error);
    }
}

/**
 * Parser ultra-leve de WKT para GeoJSON para evitar dependências pesadas no frontend.
 * Suporta estruturas básicas de MULTIPOLYGON sadias vindas do DuckDB.
 */
function parseWKTToGeoJSON(wkt, pais) {
    try {
        // Remove o prefixo MULTIPOLYGON e limpa os parênteses
        let cleaned = wkt.replace(/MULTIPOLYGON\s*\(\s*\(\s*\(/i, '').replace(/\s*\)\s*\)\s*\)$/, '');
        const polygonsRaw = cleaned.split(/\)\s*,\s*\(/);
        
        const coordinates = polygonsRaw.map(poly => {
            const ringsRaw = poly.split(/\)\s*,\s*\(/);
            return ringsRaw.map(ring => {
                // Remove parênteses restantes se existirem
                const pointsStr = ring.replace(/\(|\)/g, '').trim().split(/\s*,\s*/);
                return pointsStr.map(pt => {
                    const [lng, lat] = pt.trim().split(/\s+/).map(Number);
                    return [lng, lat]; // GeoJSON usa [longitude, latitude]
                });
            });
        });

        return {
            "type": "Feature",
            "properties": { "pais": pais },
            "geometry": {
                "type": "MultiPolygon",
                "coordinates": coordinates
            }
        };
    } catch (err) {
        console.error("Falha ao parsear WKT do DuckDB:", wkt, err);
        return null;
    }
}

/**
 * Foca a câmera do mapa nas regiões desenhadas de forma suave
 */
function focusOnRegions() {
    if (geojsonGroup && geojsonGroup.getLayers().length > 0) {
        map.flyToBounds(geojsonGroup.getBounds(), { 
            padding: [50, 50],
            duration: 1.5 // Transição suave
        });
    }
}