// ==========================================================================
// GEOMISKIN — BIVARIATE TAB (Tercile Classification, Leaflet Bivariate Map, Plotly Scatter, OLS Trend)
// ==========================================================================

import { getInterpolatedColor } from '../main.js';

let map = null;
let geojsonLayer = null;
let isInitialized = false;

// 15 variables list
const VARIABLES = [
  "Persentase Penduduk Miskin (%)",
  "Indeks Pembangunan Manusia (IPM)",
  "Rata-rata Lamanya Sekolah",
  "Harapan Lama Sekolah",
  "Pengeluaran per Kapita (Rupiah/orang)",
  "Persentase Rumah Tangga dengan Akses Sanitasi Layak",
  "Persentase Rumah Tangga dengan Akses Air Minum Layak",
  "Prevalensi Ketidakcukupan Konsumsi Pangan (%)",
  "Indeks Ketahanan Pangan (IKP)",
  "Gini Ratio",
  "Kepadatan Penduduk (km²)",
  "Jumlah Tenaga Kesehatan",
  "Tingkat Pengangguran Terbuka (TPT)",
  "Laju Pertumbuhan Produk Domestik Regional Bruto Atas Dasar Harga Konstan 2010",
  "Persentase Penduduk yang Bekerja di Sektor Pertanian"
];

// Premium 3x3 Bivariate Color Matrix (Low to High)
// Matrix[Y_index][X_index] where index is 0, 1, 2
const COLOR_MATRIX = [
  // Y Low (Row 0)
  ['#e8e8e8', '#b0d5df', '#64acbe'],
  // Y Mid (Row 1)
  ['#e4acac', '#ad9ea5', '#627f8c'],
  // Y High (Row 2)
  ['#c85a5a', '#985356', '#56424e']
];

export function initBivariateTab() {
  if (isInitialized) return;
  isInitialized = true;
  console.log("Initializing Bivariate Tab...");
  
  populateDropdowns();
  initBivariateMap();
  renderBivariateLegend();
  updateBivariateAnalysis();
  
  // Select listeners
  document.getElementById('select-var-x').addEventListener('change', updateBivariateAnalysis);
  document.getElementById('select-var-y').addEventListener('change', updateBivariateAnalysis);
}

// Populate X and Y dropdown options
function populateDropdowns() {
  const selectX = document.getElementById('select-var-x');
  const selectY = document.getElementById('select-var-y');
  
  if (!selectX || !selectY) return;

  const optionsX = VARIABLES.map((v, i) => `
    <option value="${v}" ${v.includes("Pembangunan Manusia") ? "selected" : ""}>${v}</option>
  `).join('');

  const optionsY = VARIABLES.map((v, i) => `
    <option value="${v}" ${v.includes("Penduduk Miskin") ? "selected" : ""}>${v}</option>
  `).join('');

  selectX.innerHTML = optionsX;
  selectY.innerHTML = optionsY;
}

// Calculate Tercile thresholds (33.3% and 66.6% values)
function getTerciles(arr) {
  const sorted = [...arr].sort((a, b) => a - b);
  const n = sorted.length;
  const t1 = sorted[Math.floor(n * 0.333)];
  const t2 = sorted[Math.floor(n * 0.666)];
  return [t1, t2];
}

// Get tercile tier (0, 1, 2)
function getTier(val, thresholds) {
  if (val <= thresholds[0]) return 0;
  if (val <= thresholds[1]) return 1;
  return 2;
}

// Initialize Leaflet map
function initBivariateMap() {
  if (map) return;
  
  map = L.map('map-bivariate', {
    center: [-2.5, 118],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(map);
}

// Render bivariate 3x3 tilted legend in sidebar
function renderBivariateLegend() {
  const container = document.getElementById('bivariate-grid-legend');
  if (!container) return;

  let html = '';
  // Loop rows backward so Y-High is at the top
  for (let y = 2; y >= 0; y--) {
    for (let x = 0; x < 3; x++) {
      const color = COLOR_MATRIX[y][x];
      html += `
        <div class="bivariate-cell" style="background-color: ${color}" title="X Tier ${x}, Y Tier ${y}"></div>
      `;
    }
  }
  container.innerHTML = html;
}

// Main logic to update map styling, OLS trendline, and scatter plot
function updateBivariateAnalysis() {
  const varX = document.getElementById('select-var-x').value;
  const varY = document.getElementById('select-var-y').value;

  console.log(`Updating Bivariate Analysis: X=${varX}, Y=${varY}`);

  const data = window.AppStore.provinces;
  if (!data || data.length === 0) return;

  // 1. Calculate terciles for X and Y
  const valuesX = data.map(d => d[varX] || 0);
  const valuesY = data.map(d => d[varY] || 0);

  const tercilesX = getTerciles(valuesX);
  const tercilesY = getTerciles(valuesY);

  // 2. Custom styling function for geojson layers
  function style(feature) {
    const props = feature.properties;
    const valX = props[varX] || 0;
    const valY = props[varY] || 0;

    const tierX = getTier(valX, tercilesX);
    const tierY = getTier(valY, tercilesY);

    const color = COLOR_MATRIX[tierY][tierX];

    return {
      fillColor: color,
      weight: 1.5,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.85
    };
  }

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 3,
      color: 'hsl(221, 83%, 53%)',
      fillOpacity: 0.95
    });
    layer.bringToFront();

    const props = layer.feature.properties;
    const valX = props[varX] || 0;
    const valY = props[varY] || 0;

    layer.bindTooltip(`
      <div class="leaflet-tooltip-geomiskin">
        <div class="tooltip-title">${props.PROVINSI}</div>
        <div class="tooltip-row"><span>X (${varX.split(' (')[0]}):</span><span class="tooltip-val">${valX.toLocaleString('id-ID')}</span></div>
        <div class="tooltip-row"><span>Y (${varY.split(' (')[0]}):</span><span class="tooltip-val">${valY.toLocaleString('id-ID')}</span></div>
      </div>
    `, { sticky: true, direction: 'top' }).openTooltip();
  }

  function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
  }

  // Clear existing layers if any
  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  // Draw GeoJSON
  geojsonLayer = L.geoJSON(window.AppStore.geojson, {
    style: style,
    onEachFeature: function(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e) => {
          map.fitBounds(e.target.getBounds());
        }
      });
    }
  }).addTo(map);

  // 3. Render Plotly Scatter Plot with OLS Trendline
  renderScatterPlot(varX, varY, valuesX, valuesY, tercilesX, tercilesY);
}

// Plotly render helper
function renderScatterPlot(varX, varY, valuesX, valuesY, tercilesX, tercilesY) {
  const container = document.getElementById('plotly-bivariate');
  if (!container) return;

  const provinces = window.AppStore.provinces;

  // Let's compute OLS Trendline: Y = m*X + c
  const n = valuesX.length;
  let sumX = 0, sumY = 0, sumXY = 0, sumX2 = 0;
  for (let i = 0; i < n; i++) {
    sumX += valuesX[i];
    sumY += valuesY[i];
    sumXY += valuesX[i] * valuesY[i];
    sumX2 += valuesX[i] * valuesX[i];
  }
  const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
  const intercept = (sumY - slope * sumX) / n;

  // R^2 Calculation
  const avgX = sumX / n;
  const avgY = sumY / n;
  let numR = 0, denR_X = 0, denR_Y = 0;
  for (let i = 0; i < n; i++) {
    const diffX = valuesX[i] - avgX;
    const diffY = valuesY[i] - avgY;
    numR += diffX * diffY;
    denR_X += diffX * diffX;
    denR_Y += diffY * diffY;
  }
  const rCoef = numR / Math.sqrt(denR_X * denR_Y);
  const r2 = rCoef * rCoef;

  // Generate trend line points
  const minX = Math.min(...valuesX);
  const maxX = Math.max(...valuesX);
  const trendX = [minX, maxX];
  const trendY = [slope * minX + intercept, slope * maxX + intercept];

  // Grouped points based on cluster assignment
  const clusters = [0, 1, 2];
  const clusterColors = ['#ef4444', '#22c55e', '#3b82f6'];
  const clusterNames = ['Klaster 0: Kawasan Rentan', 'Klaster 1: Kawasan Menengah', 'Klaster 2: Metropolitan'];

  const traces = [];

  // 1. Add trendline trace
  traces.push({
    x: trendX,
    y: trendY,
    type: 'scatter',
    mode: 'lines',
    name: `Tren OLS (R² = ${r2.toFixed(3)})`,
    line: { color: 'rgba(100, 116, 139, 0.65)', width: 2, dash: 'dash' },
    hoverinfo: 'none'
  });

  // 2. Add scatter points for each cluster
  clusters.forEach(c => {
    const cData = provinces.filter(p => p.cluster === c);
    const cX = cData.map(p => p[varX] || 0);
    const cY = cData.map(p => p[varY] || 0);
    const cNames = cData.map(p => p.Provinsi);

    traces.push({
      x: cX,
      y: cY,
      type: 'scatter',
      mode: 'markers',
      name: clusterNames[c],
      text: cNames,
      hovertemplate: '<b>%{text}</b><br>' +
                    `${varX.split(' (')[0]}: %{x:.2f}<br>` +
                    `${varY.split(' (')[0]}: %{y:.2f}<extra></extra>`,
      marker: {
        color: clusterColors[c],
        size: 9,
        line: { color: '#ffffff', width: 1.5 },
        opacity: 0.85
      }
    });
  });

  const layout = {
    margin: { t: 10, b: 45, l: 45, r: 15 },
    hovermode: 'closest',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.2,
      x: 0,
      font: { size: 9, family: 'Inter' }
    },
    xaxis: {
      title: { text: varX, font: { size: 10, family: 'Inter', weight: 600 } },
      gridcolor: '#e2e8f0',
      zeroline: false
    },
    yaxis: {
      title: { text: varY, font: { size: 10, family: 'Inter', weight: 600 } },
      gridcolor: '#e2e8f0',
      zeroline: false
    },
    plot_bgcolor: '#f8fafc',
    paper_bgcolor: 'rgba(0,0,0,0)'
  };

  const config = {
    responsive: true,
    displayModeBar: false
  };

  Plotly.newPlot(container, traces, layout, config);
}
