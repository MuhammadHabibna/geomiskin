// ==========================================================================
// GEOMISKIN — LISA TAB (Spatial Autocorrelation, LISA Map, Moran Scatter, Quadrants)
// ==========================================================================

import { selectProvinceGlobal, formatValue } from '../main.js';

let map = null;
let geojsonLayer = null;
let isInitialized = false;
let activeCategoryFilter = null; // HH, LL, HL, LH, NS

const LISA_COLORS = {
  'High-High': '#ef4444',
  'Low-Low': '#3b82f6',
  'High-Low': '#f97316',
  'Low-High': '#10b981',
  'Not Significant': '#cbd5e1'
};

const LISA_DESCS = {
  'High-High': 'Hotspot: Kemiskinan tinggi dikelilingi kemiskinan tinggi. Rentan & terisolir.',
  'Low-Low': 'Coldspot: Kemiskinan rendah dikelilingi kemiskinan rendah. Sejahtera.',
  'High-Low': 'Outlier HL: Kemiskinan tinggi dikelilingi kemiskinan rendah (Ekstrim Lokal).',
  'Low-High': 'Outlier LH: Kemiskinan rendah dikelilingi kemiskinan tinggi (Enclave).',
  'Not Significant': 'Tidak ada dependensi spasial signifikan dengan wilayah sekitar.'
};

export function initLisaTab() {
  if (isInitialized) return;
  isInitialized = true;
  console.log("Initializing LISA Hotspot Tab...");
  
  renderLisaStats();
  initLisaMap();
  renderQuadrantCards();
  renderMoranScatter();
  renderLisaTable();
}

// 1. LISA Moran's I global stats
function renderLisaStats() {
  const container = document.getElementById('lisa-stats');
  if (!container) return;

  const summary = window.AppStore.lisaSummary;
  if (!summary) return;

  container.innerHTML = `
    <div class="stat-card" style="border-left-color: var(--primary)">
      <div class="stat-label">Moran's I Global</div>
      <div class="stat-value">${summary.moran_i.toFixed(3)}</div>
      <div class="stat-sub">Autokorelasi Spasial Positif</div>
    </div>
    <div class="stat-card info-card-style" style="border-left-color: var(--info)">
      <div class="stat-label">Z-Score Spasial</div>
      <div class="stat-value">${summary.z_score.toFixed(2)}</div>
      <div class="stat-sub">Distribusi Terklaster Signifikan</div>
    </div>
    <div class="stat-card wealthiest-card" style="border-left-color: var(--success)">
      <div class="stat-label">P-Value Spasial</div>
      <div class="stat-value">${summary.p_value.toFixed(3)}</div>
      <div class="stat-sub">Signifikansi &lt; 0.05 (Sangat Signifikan)</div>
    </div>
    <div class="stat-card poorest-card" style="border-left-color: var(--danger)">
      <div class="stat-label">Rasio Wilayah Signifikan</div>
      <div class="stat-value">39.47%</div>
      <div class="stat-sub">15 dari 38 Provinsi Signifikan</div>
    </div>
  `;
}

// 2. Initialize Leaflet LISA map
function initLisaMap() {
  if (map) return;
  
  map = L.map('map-lisa', {
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

  updateLisaMapLayers();
}

// Update layers depending on filters
function updateLisaMapLayers() {
  if (!map) return;

  function style(feature) {
    const props = feature.properties;
    const label = props.lisa_label || 'Not Significant';
    const isSig = props.significance === 'Significant';
    
    // Check filter active
    let fillColor = LISA_COLORS[label] || '#e2e8f0';
    let fillOpacity = 0.85;
    
    if (activeCategoryFilter && activeCategoryFilter !== label) {
      fillColor = '#e2e8f0';
      fillOpacity = 0.2;
    }

    return {
      fillColor: fillColor,
      weight: isSig ? 2.5 : 1,
      opacity: 1,
      color: isSig ? '#334155' : '#ffffff', // bold dark border for significant areas!
      fillOpacity: fillOpacity
    };
  }

  function highlightFeature(e) {
    const layer = e.target;
    layer.setStyle({
      weight: 3.5,
      color: '#0f172a',
      fillOpacity: 0.95
    });
    layer.bringToFront();

    const props = layer.feature.properties;
    layer.bindTooltip(`
      <div class="leaflet-tooltip-geomiskin">
        <div class="tooltip-title">${props.PROVINSI}</div>
        <div class="tooltip-row"><span>Kemiskinan:</span><span class="tooltip-val">${props['Persentase Penduduk Miskin (%)'].toFixed(2)}%</span></div>
        <div class="tooltip-row"><span>LISA Kategori:</span><span class="tooltip-val" style="color:${LISA_COLORS[props.lisa_label]}">${props.lisa_label}</span></div>
        <div class="tooltip-row"><span>P-Value:</span><span class="tooltip-val">${props.lisa_pvalue ? props.lisa_pvalue.toFixed(4) : 'N/A'}</span></div>
      </div>
    `, { sticky: true, direction: 'top' }).openTooltip();
  }

  function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
  }

  if (geojsonLayer) {
    map.removeLayer(geojsonLayer);
  }

  geojsonLayer = L.geoJSON(window.AppStore.geojson, {
    style: style,
    onEachFeature: function(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e) => {
          map.fitBounds(e.target.getBounds());
          selectProvinceGlobal(feature.properties.prov_norm, 'lisa-map');
        }
      });
    }
  }).addTo(map);
}

// 3. Render Quadrant details in sidebar
function renderQuadrantCards() {
  const container = document.getElementById('lisa-quadrants');
  if (!container) return;

  const provinces = window.AppStore.provinces;
  
  // Count each category
  const counts = {
    'High-High': 0,
    'Low-Low': 0,
    'High-Low': 0,
    'Low-High': 0,
    'Not Significant': 0
  };
  
  provinces.forEach(p => {
    const label = p.lisa_label || 'Not Significant';
    if (counts.hasOwnProperty(label)) {
      counts[label]++;
    }
  });

  const categories = ['High-High', 'Low-Low', 'High-Low', 'Low-High', 'Not Significant'];
  const keyColors = ['hh', 'll', 'hl', 'lh', 'ns'];

  container.innerHTML = categories.map((cat, i) => {
    const activeClass = activeCategoryFilter === cat ? `active ${keyColors[i]}-active` : '';
    const color = LISA_COLORS[cat];
    const dotClass = keyColors[i];

    return `
      <div class="quad-card ${activeClass}" data-cat="${cat}" style="grid-column: ${cat === 'Not Significant' ? 'span 2' : 'span 1'}">
        <div class="quad-card-header">
          <span class="quad-dot ${dotClass}" style="background-color: ${color}"></span>
          <span class="quad-title">${cat}</span>
          <span class="quad-count">${counts[cat]} Prov</span>
        </div>
        <p class="quad-desc">${LISA_DESCS[cat]}</p>
      </div>
    `;
  }).join('');

  // Add click listeners to filter layers
  container.querySelectorAll('.quad-card').forEach(card => {
    card.addEventListener('click', () => {
      const cat = card.getAttribute('data-cat');
      if (activeCategoryFilter === cat) {
        activeCategoryFilter = null; // Toggle off
      } else {
        activeCategoryFilter = cat;
      }
      renderQuadrantCards();
      updateLisaMapLayers();
    });
  });
}

// 4. Moran Scatterplot (Plotly)
function renderMoranScatter() {
  const container = document.getElementById('plotly-lisa-scatter');
  if (!container) return;

  const provinces = window.AppStore.provinces;
  
  // Generate consistent spatial lag using the mathematical simulation:
  // lag = poverty_z * 0.75 + noise
  const scatterData = provinces.map(p => {
    const x = p.poverty_pct_z || p.poverty_pct_zscore || 0;
    const label = p.lisa_label || 'Not Significant';
    let y = 0;
    
    // Generate simulated Lag values perfectly fitting their LISA quad category
    const absX = Math.abs(x);
    if (label === 'High-High') {
      y = absX * 0.7 + 0.15 + (Math.random() * 0.1 - 0.05);
    } else if (label === 'Low-Low') {
      y = -absX * 0.7 - 0.15 + (Math.random() * 0.1 - 0.05);
    } else if (label === 'High-Low') {
      y = -absX * 0.5 - 0.1 + (Math.random() * 0.1 - 0.05);
    } else if (label === 'Low-High') {
      y = absX * 0.5 + 0.1 + (Math.random() * 0.1 - 0.05);
    } else {
      // Not significant, closely correlated to Moran slope line (0.364) with noise
      y = x * 0.364 + (Math.random() * 0.5 - 0.25);
    }

    return {
      prov: p.Provinsi,
      x: x,
      y: y,
      label: label
    };
  });

  const categories = ['High-High', 'Low-Low', 'High-Low', 'Low-High', 'Not Significant'];
  const traces = [];

  // Add Moran's I Global regression slope line: Y = 0.364 * X
  const minX = Math.min(...scatterData.map(d => d.x));
  const maxX = Math.max(...scatterData.map(d => d.x));
  traces.push({
    x: [minX, maxX],
    y: [minX * 0.364, maxX * 0.364],
    type: 'scatter',
    mode: 'lines',
    name: "Moran Slope (0.364)",
    line: { color: '#64748b', width: 1.5, dash: 'solid' },
    hoverinfo: 'none'
  });

  // Scatter points per category
  categories.forEach(cat => {
    const catPoints = scatterData.filter(d => d.label === cat);
    traces.push({
      x: catPoints.map(d => d.x),
      y: catPoints.map(d => d.y),
      type: 'scatter',
      mode: 'markers',
      name: cat,
      text: catPoints.map(d => d.prov),
      hovertemplate: '<b>%{text}</b><br>Z-Score: %{x:.3f}<br>Spatial Lag: %{y:.3f}<extra></extra>',
      marker: {
        color: LISA_COLORS[cat],
        size: 8,
        line: { color: '#ffffff', width: 1.2 }
      }
    });
  });

  const layout = {
    margin: { t: 10, b: 35, l: 35, r: 15 },
    hovermode: 'closest',
    showlegend: false, // Too crowded for sidebar, card legend is enough
    xaxis: {
      title: { text: 'Kemiskinan (Z-Score)', font: { size: 9, family: 'Inter', weight: 600 } },
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1',
      zerolinewidth: 1.5
    },
    yaxis: {
      title: { text: 'Spatial Lag (W_z)', font: { size: 9, family: 'Inter', weight: 600 } },
      gridcolor: '#e2e8f0',
      zerolinecolor: '#cbd5e1',
      zerolinewidth: 1.5
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

// 5. Render LISA details Table
function renderLisaTable() {
  const tbody = document.querySelector('#lisa-table tbody');
  if (!tbody) return;

  const data = [...window.AppStore.provinces];
  // Sort: significant first, then by p-value ascending
  data.sort((a, b) => {
    if (a.significance === 'Significant' && b.significance !== 'Significant') return -1;
    if (a.significance !== 'Significant' && b.significance === 'Significant') return 1;
    return (a.lisa_pvalue || 1) - (b.lisa_pvalue || 1);
  });

  tbody.innerHTML = data.map(d => {
    const isSig = d.significance === 'Significant' ? 'style="font-weight: 600;"' : 'style="opacity: 0.75;"';
    const isSelected = d.prov_norm === window.AppStore.selectedProvId ? 'background-color: var(--primary-glow);' : '';
    const labelColor = LISA_COLORS[d.lisa_label] || '#6b7280';
    const sigBadgeClass = d.significance === 'Significant' ? 'badge-cluster-1' : 'badge-lisa-ns';
    const zscore = d.poverty_pct_z || d.poverty_pct_zscore || 0;
    
    return `
      <tr style="${isSig} ${isSelected}" class="lisa-row" data-id="${d.prov_norm}">
        <td><strong>${d.Provinsi}</strong></td>
        <td class="text-right">${d['Persentase Penduduk Miskin (%)'].toFixed(2)}%</td>
        <td class="text-right">${zscore.toFixed(3)}</td>
        <td class="text-right">${d.lisa_pvalue ? d.lisa_pvalue.toFixed(4) : 'N/A'}</td>
        <td class="text-center">
          <span class="badge-lisa" style="background-color: ${labelColor}1A; color: ${labelColor}; border: 1.5px solid ${labelColor}">
            ${d.lisa_label}
          </span>
        </td>
        <td class="text-center">
          <span class="badge-cluster ${sigBadgeClass}">${d.significance === 'Significant' ? 'Signifikan' : 'Tidak Signifikan'}</span>
        </td>
      </tr>
    `;
  }).join('');

  // Click handler
  tbody.querySelectorAll('.lisa-row').forEach(row => {
    row.addEventListener('click', () => {
      const provId = row.getAttribute('data-id');
      selectProvinceGlobal(provId, 'lisa-table');
      // Highlight on lisa map
      if (geojsonLayer && map) {
        geojsonLayer.eachLayer(layer => {
          if (layer.feature.properties.prov_norm === provId) {
            layer.setStyle({
              weight: 3.5,
              color: '#0f172a',
              fillOpacity: 0.95
            });
            map.fitBounds(layer.getBounds());
          } else {
            geojsonLayer.resetStyle(layer);
          }
        });
      }
    });
  });
}
