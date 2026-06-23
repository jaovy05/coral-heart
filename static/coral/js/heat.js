/**
 * BlueHorizon - Módulo de Renderização de Calor Oceanográfico (Oceanic UI)
 * Focado em alta performance (HTML5 Canvas) e controle de dispersão térmica.
 */

// Configuração e Estado Centralizado do Módulo Térmico
const HeatmapModule = {
    instance: null,
    debugGroup: L.layerGroup(),
    currentRadius: 25,
    currentMaxIntensity: 1.0,

    // Configurações cromáticas - Do frio abissal ao perigo dos corais (Azul -> Vermelho)
    gradientPalette: {
        0.0: '#9ebfe6',   // Azul pastel
        0.18: '#a8d7ef',  // Azul claro suave
        0.36: '#a6e3d8',  // Ciano suave
        0.55: '#b7e2b7',  // Verde suave
        0.72: '#f3e09d',  // Amarelo areia
        0.88: '#f4c1a8',  // Pêssego
        0.97: '#ea9aa2',  // Coral suave
        1.0: '#cf6b6f'    // Vermelho queimado
    },

    /**
     * Inicializa a camada de calor no mapa e associa o grupo de depuração
     * @param {L.Map} mapInstance - Instância ativa do mapa Leaflet
     */
    init: function(mapInstance) {
        this.map = mapInstance;
        this.debugGroup.addTo(this.map);
    },

    /**
     * Processa a resposta do endpoint getDadosDia e renderiza a camada térmica
     * @param {Object} apiResponse - Payload JSON { dados: [...], extreme_temperatura: [max, min] }
     */
    render: function(apiResponse) {
        if (!this.map) {
            console.error("Módulo Térmico: O mapa não foi inicializado. Chame HeatmapModule.init(map).");
            return;
        }

        const dados = apiResponse.dados;
        const extremos = apiResponse.extreme_temperatura; // Formato esperado: [max, min]

        if (!dados || dados.length === 0) {
            console.warn("Módulo Térmico: Nenhum dado de telemetria disponível na resposta.");
            return;
        }

        // Recupera extremos calculados no DuckDB com fallbacks defensivos
        let maxTemp = 27.0;
        let minTemp = 14.0;

        if (Array.isArray(extremos) && extremos.length >= 2) {
            maxTemp = parseFloat(extremos[0]);
            minTemp = parseFloat(extremos[1]);
        } else if (extremos) {
            // Tratamento preventivo caso venha apenas um número bruto ou estrutura alternativa
            maxTemp = parseFloat(extremos);
        }

        const delta = maxTemp - minTemp;

        // Atualiza elementos estáticos de UI (Legendas térmicas do console) se existirem na página
        this.updateUIElements(minTemp, maxTemp);

        // Prepara pontos para a biblioteca leaflet-heat: [lat, lng, intensidade_normalizada]
        const heatPoints = dados.map(ponto => {
            let intensidade = 0.5; // Caso neutro para evitar divisão por zero se delta for 0
            if (delta > 0) {
                const normalized = (ponto.temperatura - minTemp) / delta;
                // Exagera levemente a parte alta da escala para tornar o vermelho visível no canvas
                intensidade = Math.pow(Math.max(0, Math.min(1, normalized)), 0.75);
            }
            return [ponto.lat, ponto.lng, intensidade];
        });

        // Limpa a instância de calor anterior para evitar vazamento de memória (Memory Leak)
        if (this.instance) {
            this.map.removeLayer(this.instance);
        }

        // Instancia a nova camada utilizando o plugin Leaflet.heat
        this.instance = L.heatLayer(heatPoints, {
            radius: 40,
            blur: 25,
            max: this.currentMaxIntensity,
            minOpacity: 0.3,
            gradient: this.gradientPalette
        }).addTo(this.map);

        // Se o trigger de debug estiver ativo na UI, reconstrói os marcadores físicos
        const toggleDebug = document.getElementById('toggle-debug');
        if (toggleDebug && toggleDebug.checked) {
            this.drawDebugMarkers(dados);
        }
    },

    /**
     * Altera de forma dinâmica as configurações de escala e renderiza em tempo real
     * @param {number} radius - Raio de influência térmica em pixels
     * @param {number} maxIntensity - Intensidade máxima/sensibilidade do gradiente
     */
    updateScale: function(radius, maxIntensity) {
        this.currentRadius = parseInt(radius);
        this.currentMaxIntensity = parseFloat(maxIntensity);

        if (this.instance) {
            this.instance.setOptions({
                radius: this.currentRadius,
                max: this.currentMaxIntensity,
                gradient: this.gradientPalette
            });
        }
    },

    /**
     * Atualiza as leituras textuais e gradientes visuais no layout principal
     */
    updateUIElements: function(min, max) {
        const elMax = document.getElementById('global-max');
        const elMin = document.getElementById('global-min');
        const legMax = document.getElementById('legend-max');
        const legMin = document.getElementById('legend-min');

        if (elMax) elMax.innerText = `${max.toFixed(2)} °C`;
        if (elMin) elMin.innerText = `${min.toFixed(2)} °C`;
        if (legMax) legMax.innerText = `Max: ${max.toFixed(1)} °C`;
        if (legMin) legMin.innerText = `Min: ${min.toFixed(1)} °C`;
    },

    /* ==========================================
       SEÇÃO DE DEPURAÇÃO - REMOVER EM PRODUÇÃO
       ========================================== */
    /**
     * Desenha marcadores pretos estáticos com popups informativos sobre os pontos reais
     * @param {Array} dados - Lista bruta de pontos do banco
     */
    drawDebugMarkers: function(dados) {
        this.debugGroup.clearLayers();

        dados.forEach(ponto => {
            const debugIcon = L.divIcon({
                html: `
                    <div class="custom-debug-marker">
                        <span class="custom-debug-marker__pulse"></span>
                        <span class="custom-debug-marker__core"></span>
                    </div>
                `,
                className: 'custom-debug-icon',
                iconSize: [16, 16],
                iconAnchor: [8, 8]
            });

            const marker = L.marker([ponto.lat, ponto.lng], { icon: debugIcon });
            
            // Popup rico de telemetria para verificação científica do operador
            marker.bindPopup(`
                <div class="p-2 font-mono text-[10px]" style="min-width: 140px;">
                    <strong style="color: #e79f8b; display: block; margin-bottom: 4px;">TESTE DE PONTO</strong>
                    <span style="color: #94a3b8">Lat:</span> ${ponto.lat}<br/>
                    <span style="color: #94a3b8">Lng:</span> ${ponto.lng}<br/>
                    <span style="color: #94a3b8">Temp:</span> <span style="font-weight: bold; color: #e79f8b;">${ponto.temperatura}°C</span><br/>
                    <span style="color: #94a3b8">Oxigênio:</span> ${ponto.oxigenio || '--'}<br/>
                    <span style="color: #94a3b8">Plancton:</span> ${ponto.plancton || '--'}<br/>
                    <span style="color: #94a3b8">Prof:</span> ${ponto.profundidade}m
                </div>
            `);

            this.debugGroup.addLayer(marker);
        });
    },


    toggleDebug: function(isChecked, dados) {
        if (isChecked) {
            this.drawDebugMarkers(dados);
        } else {
            this.debugGroup.clearLayers();
        }
    }
};