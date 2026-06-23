function parseWKTToGeoJSON(wkt, pais) {
    try {
        const cleaned = wkt.replace(/MULTIPOLYGON\s*\(\s*\(\s*\(/i, '').replace(/\s*\)\s*\)\s*\)$/, '');
        const polygonsRaw = cleaned.split(/\)\s*,\s*\(/);

        const coordinates = polygonsRaw.map((poly) => {
            const ringsRaw = poly.split(/\)\s*,\s*\(/);
            return ringsRaw.map((ring) => {
                const pointsStr = ring.replace(/\(|\)/g, '').trim().split(/\s*,\s*/);
                return pointsStr.map((pt) => {
                    const [lng, lat] = pt.trim().split(/\s+/).map(Number);
                    return [lng, lat];
                });
            });
        });

        return {
            type: 'Feature',
            properties: { pais },
            geometry: {
                type: 'MultiPolygon',
                coordinates
            }
        };
    } catch (err) {
        console.error('Falha ao parsear WKT do DuckDB:', wkt, err);
        return null;
    }
}

function renderizarRegioes() {
    try {
        const rawData = document.getElementById('recifes-data').textContent;
        const regioes = JSON.parse(rawData);

        regioes.forEach((regiao) => {
            let geojsonFeature;

            if (typeof regiao.coordenadas === 'object') {
                geojsonFeature = {
                    type: 'Feature',
                    properties: {
                        pais: regiao.pais,
                        id: regiao.id
                    },
                    geometry: regiao.coordenadas
                };
            } else if (typeof regiao.coordenadas === 'string' && regiao.coordenadas.startsWith('MULTIPOLYGON')) {
                geojsonFeature = parseWKTToGeoJSON(regiao.coordenadas, regiao.pais);
            }

            if (!geojsonFeature) {
                return;
            }

            const layer = L.geoJSON(geojsonFeature, {
                style: {
                    stroke: true,       // ❌ Remove completamente a linha de contorno
                    fillColor: '#000',   // Cor irrelevante, pois estará invisível
                    fillOpacity: 0,      // 🌟 Deixa o preenchimento 100% transparente
                }
            });

            layer.on({
                mouseover: (e) => {
                    e.target.setStyle({
                        fillColor: '#cfe0ea',
                        fillOpacity: 0.42,
                        weight: 2
                    });
                },
                mouseout: (e) => {
                    layer.resetStyle(e.target);
                }
            });

            layer.bindTooltip('Clique para ver os dados do mês', {
                direction: 'center',
                sticky: true,
                opacity: 1,
                className: 'reef-tooltip'
            });

            layer.on('click', () => {
                abrirModalMediaMes(regiao);
            });

            geojsonGroup.addLayer(layer);
        });
    } catch (error) {
        console.error('Erro ao ler dados espaciais do Django:', error);
    }
}

function carregarDadosEHeatmap() {
    fetch('/getDadosDia/')
        .then((response) => {
            if (!response.ok) {
                throw new Error(`Erro na requisição de telemetria: ${response.status}`);
            }
            return response.json();
        })
        .then((payload) => {
            window.dadosAtivos = payload.dados;

            telemetryGroup.clearLayers();
            if (payload.dados && payload.dados.length > 0) {
                payload.dados.forEach((ponto) => {
                    if (ponto.lat && ponto.lng) {
                        telemetryGroup.addLayer(L.circleMarker([ponto.lat, ponto.lng], { radius: 1, opacity: 0, fillOpacity: 0 }));
                    }
                });
            }

            if (typeof HeatmapModule !== 'undefined') {
                HeatmapModule.render(payload);
            }

            focusOnTelemetry();
        })
        .catch((err) => {
            console.error('Erro ao carregar telemetria oceanográfica:', err);
        });
}

function focusOnTelemetry() {
    if (telemetryGroup && telemetryGroup.getLayers().length > 0) {
        map.flyToBounds(telemetryGroup.getBounds(), {
            padding: [80, 80],
            duration: 1.2
        });
    } else {
        map.flyTo([-10.0, -36.0], 5, { duration: 1.2 });
    }
}

function focusOnRegions() {
    if (geojsonGroup && geojsonGroup.getLayers().length > 0) {
        map.flyToBounds(geojsonGroup.getBounds(), {
            padding: [60, 60],
            duration: 1.5
        });
    }
}
