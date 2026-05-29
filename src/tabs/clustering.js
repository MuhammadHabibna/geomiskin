// ==========================================================================
// GEOMISKIN — CLUSTERING TAB (SC-Clustering Map, Sync Map Comparison, Dual-Axis Elbow, Grouped Bars)
// ==========================================================================

import { formatValue } from '../main.js';

let mapSingle = null;
let geojsonLayerSingle = null;

let mapCompLeft = null; // Sync Map Left (SC-Clustering)
let mapCompRight = null; // Sync Map Right (LISA)
let layerCompLeft = null;
let layerCompRight = null;

let isInitialized = false;
let activeLayout = 'single'; // 'single' or 'comparison'

const CLUSTER_COLORS = ['#ef4444', '#22c55e', '#3b82f6'];
const CLUSTER_NAMES = [
  'Klaster 0: Kawasan Rentan & Tertinggal',
  'Klaster 1: Kawasan Menengah & Berkembang',
  'Klaster 2: Kawasan Metropolitan Ekstrem'
];

const CLUSTER_DESCS = [
  'Daerah dengan kemiskinan tinggi, IPM rendah, kerawanan pangan tinggi, dan infrastruktur sanitasi yang minim.',
  'Daerah berkembang dengan kemiskinan terkendali, pertumbuhan ekonomi stabil, IPM sedang, dan jaminan sosial cukup.',
  'Daerah urban/metropolitan dengan kesejahteraan tinggi, IPM sangat tinggi, gini ratio lebar, dan kepadatan padat (DKI Jakarta).'
];

const LISA_COLORS = {
  'High-High': '#ef4444',
  'Low-Low': '#3b82f6',
  'High-Low': '#f97316',
  'Low-High': '#10b981',
  'Not Significant': '#cbd5e1'
};

export function initClusteringTab() {
  if (isInitialized) return;
  isInitialized = true;
  console.log("Initializing Spatial Clustering Tab...");

  initSingleMap();
  renderClusterProfiles();
  renderEvaluationPlot();
  renderGroupedBarChart();
  setupLayoutToggle();
}

// 1. Initialize Single Map View
function initSingleMap() {
  if (mapSingle) return;

  mapSingle = L.map('map-cluster', {
    center: [-2.5, 118],
    zoom: 5,
    minZoom: 4,
    maxZoom: 10
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(mapSingle);

  // Layer details label
  const label = document.getElementById('cluster-layer-legend-label');
  if (label) {
    label.innerHTML = `
      <div style="display:flex; gap:0.75rem;">
        <span class="badge-cluster badge-cluster-0">🔴 Rentan (${CLUSTER_COLORS[0]})</span>
        <span class="badge-cluster badge-cluster-1">🟢 Menengah (${CLUSTER_COLORS[1]})</span>
        <span class="badge-cluster badge-cluster-2">🔵 Metropolitan (${CLUSTER_COLORS[2]})</span>
      </div>
    `;
  }

  updateSingleMapLayer();
}

function updateSingleMapLayer() {
  if (!mapSingle) return;

  function style(feature) {
    const c = feature.properties.cluster;
    return {
      fillColor: CLUSTER_COLORS[c] || '#cbd5e1',
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
      color: '#0f172a',
      fillOpacity: 0.95
    });
    layer.bringToFront();

    const props = layer.feature.properties;
    layer.bindTooltip(`
      <div class="leaflet-tooltip-geomiskin">
        <div class="tooltip-title">${props.PROVINSI}</div>
        <div class="tooltip-row"><span>Klaster:</span><span class="tooltip-val" style="color:${CLUSTER_COLORS[props.cluster]}">Klaster ${props.cluster}</span></div>
        <div class="tooltip-row"><span>Kemiskinan:</span><span class="tooltip-val">${props['Persentase Penduduk Miskin (%)'].toFixed(2)}%</span></div>
        <div class="tooltip-row"><span>IPM:</span><span class="tooltip-val">${props['Indeks Pembangunan Manusia (IPM)'].toFixed(2)}</span></div>
      </div>
    `, { sticky: true, direction: 'top' }).openTooltip();
    
    renderClusterSummaryCard(props.cluster);
  }

  function resetHighlight(e) {
    geojsonLayerSingle.resetStyle(e.target);
  }

  if (geojsonLayerSingle) {
    mapSingle.removeLayer(geojsonLayerSingle);
  }

  geojsonLayerSingle = L.geoJSON(window.AppStore.geojson, {
    style: style,
    onEachFeature: function(feature, layer) {
      layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: (e) => {
          mapSingle.fitBounds(e.target.getBounds());
        }
      });
    }
  }).addTo(mapSingle);

  // Set default sidebar cluster display
  renderClusterSummaryCard(0);
}

// 2. Sidebar dynamic Cluster Summary card
function renderClusterSummaryCard(cIndex) {
  const container = document.getElementById('cluster-summary-card');
  if (!container) return;

  const profiles = window.AppStore.profiles;
  const match = profiles.find(p => p.cluster === cIndex);

  if (!match) return;

  container.innerHTML = `
    <div class="card-header" style="border-bottom:none; padding-bottom:0.25rem;">
      <span class="section-badge" style="background-color:${CLUSTER_COLORS[cIndex]}1A; color:${CLUSTER_COLORS[cIndex]}">
        Karakteristik Klaster Spasial
      </span>
      <h3 style="color:${CLUSTER_COLORS[cIndex]}; font-size:1.25rem; font-family:var(--font-heading); font-weight:800; margin-top:0.25rem;">
        ${CLUSTER_NAMES[cIndex]}
      </h3>
    </div>
    <div style="padding:0 1.5rem 1.5rem;">
      <p style="font-size:0.8rem; color:var(--neutral-700); line-height:1.5; margin-bottom:1rem;">
        ${CLUSTER_DESCS[cIndex]}
      </p>
      
      <div class="info-grid" style="grid-template-columns:1fr 1fr; gap:0.6rem;">
        <div class="info-item" style="padding:0.4rem 0.6rem;">
          <div class="info-item-label">Jumlah Anggota</div>
          <div class="info-item-val" style="font-size:1.15rem;">${match.jumlah_provinsi} Prov</div>
        </div>
        <div class="info-item" style="padding:0.4rem 0.6rem;">
          <div class="info-item-label">Rata-rata Kemiskinan</div>
          <div class="info-item-val" style="font-size:1.15rem; color:${CLUSTER_COLORS[cIndex]}">${match.poverty_pct.toFixed(2)}%</div>
        </div>
        <div class="info-item" style="padding:0.4rem 0.6rem; grid-column:span 2;">
          <div class="info-item-label">Rerata IPM Wilayah</div>
          <div class="info-item-val" style="font-size:1.15rem;">${match.ipm.toFixed(2)} (Sedang)</div>
        </div>
      </div>
    </div>
  `;
}

// 3. Render 3 cluster Profile detail cards with expanders
function renderClusterProfiles() {
  const container = document.getElementById('cluster-profiles-container');
  if (!container) return;

  const profiles = window.AppStore.profiles;
  const provinces = window.AppStore.provinces;

  container.innerHTML = profiles.map((p, i) => {
    const listProvs = provinces
      .filter(prov => prov.cluster === p.cluster)
      .map(prov => prov.Provinsi);

    // Calculate relative scaling bar percentages for major values
    // Max values for scale estimation:
    // poverty: 25%, ipm: 90, sanitation: 100%, IKP: 90
    const povPercent = (p.poverty_pct / 25) * 100;
    const ipmPercent = (p.ipm / 90) * 100;
    const sanitPercent = p.sanitation_pct;
    const ikpPercent = (p.ikp / 90) * 100;

    return `
      <div class="profile-detail-card cluster-top-${p.cluster}">
        <div class="profile-card-header">
          <div class="profile-card-title">
            <h4>${CLUSTER_NAMES[p.cluster].split(': ')[1]}</h4>
            <span class="profile-card-subtitle">SC-Clustering Ward Linkage</span>
          </div>
          <span class="badge-cluster badge-cluster-${p.cluster}">${p.jumlah_provinsi} Provinsi</span>
        </div>
        
        <p class="profile-desc">${CLUSTER_DESCS[p.cluster]}</p>
        
        <div class="profile-averages">
          <div class="average-row">
            <span class="average-label">Rata-rata Kemiskinan</span>
            <div class="average-bar-group">
              <div class="average-bar"><div class="average-bar-fill" style="width:${povPercent}%"></div></div>
              <span class="average-val">${p.poverty_pct.toFixed(2)}%</span>
            </div>
          </div>
          <div class="average-row">
            <span class="average-label">IPM Wilayah</span>
            <div class="average-bar-group">
              <div class="average-bar"><div class="average-bar-fill" style="width:${ipmPercent}%"></div></div>
              <span class="average-val">${p.ipm.toFixed(1)}</span>
            </div>
          </div>
          <div class="average-row">
            <span class="average-label">Akses Sanitasi</span>
            <div class="average-bar-group">
              <div class="average-bar"><div class="average-bar-fill" style="width:${sanitPercent}%"></div></div>
              <span class="average-val">${p.sanitation_pct.toFixed(1)}%</span>
            </div>
          </div>
          <div class="average-row">
            <span class="average-label">Indeks Ketahanan Pangan</span>
            <div class="average-bar-group">
              <div class="average-bar"><div class="average-bar-fill" style="width:${ikpPercent}%"></div></div>
              <span class="average-val">${p.ikp.toFixed(1)}</span>
            </div>
          </div>
        </div>

        <button class="members-toggle-btn" data-cluster="${p.cluster}">
          🔎 Lihat ${p.jumlah_provinsi} Provinsi Anggota
        </button>
        <div class="members-list-container hidden" id="members-list-${p.cluster}">
          ${listProvs.map(name => `• ${name}`).join('<br>')}
        </div>
      </div>
    `;
  }).join('');

  // Expand list click listener
  container.querySelectorAll('.members-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const c = btn.getAttribute('data-cluster');
      const list = document.getElementById(`members-list-${c}`);
      if (list) {
        list.classList.toggle('hidden');
        btn.innerText = list.classList.contains('hidden') 
          ? `🔎 Lihat ${profiles[c].jumlah_provinsi} Provinsi Anggota`
          : `❌ Sembunyikan Provinsi Anggota`;
      }
    });
  });
}

// 4. Silhouette & Davies-Bouldin dual-axis Plotly line chart
function renderEvaluationPlot() {
  const container = document.getElementById('plotly-cluster-eval');
  if (!container) return;

  const evalData = window.AppStore.evaluation;
  if (!evalData || evalData.length === 0) return;

  const kValues = evalData.map(d => d.k);
  const silhouette = evalData.map(d => d.silhouette);
  const dbIndex = evalData.map(d => d.davies_bouldin);

  const traces = [
    {
      x: kValues,
      y: silhouette,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Silhouette Score',
      line: { color: '#ef4444', width: 2.5 },
      marker: { size: 6 },
      yaxis: 'y'
    },
    {
      x: kValues,
      y: dbIndex,
      type: 'scatter',
      mode: 'lines+markers',
      name: 'Davies-Bouldin Index',
      line: { color: '#3b82f6', width: 2.5 },
      marker: { size: 6 },
      yaxis: 'y2'
    }
  ];

  const layout = {
    margin: { t: 25, b: 35, l: 35, r: 35 },
    hovermode: 'x unified',
    showlegend: true,
    legend: {
      orientation: 'h',
      y: -0.22,
      x: 0,
      font: { size: 9, family: 'Inter' }
    },
    xaxis: {
      title: { text: 'Jumlah Klaster (k)', font: { size: 9, family: 'Inter', weight: 600 } },
      tickvals: kValues,
      gridcolor: '#e2e8f0'
    },
    yaxis: {
      title: { text: 'Silhouette Score', font: { color: '#ef4444', size: 9, family: 'Inter', weight: 600 } },
      gridcolor: '#e2e8f0',
      zeroline: false
    },
    yaxis2: {
      title: { text: 'Davies-Bouldin Index', font: { color: '#3b82f6', size: 9, family: 'Inter', weight: 600 } },
      overlaying: 'y',
      side: 'right',
      zeroline: false
    },
    // Optimal marker annotation
    annotations: [
      {
        x: 3,
        y: 0.325,
        xref: 'x',
        yref: 'y',
        text: 'k=3 Optimal',
        showarrow: true,
        arrowhead: 6,
        arrowcolor: '#10b981',
        ax: 0,
        ay: -30,
        font: { size: 9, color: '#047857', weight: 700, family: 'Inter' },
        bgcolor: '#d1fae5',
        bordercolor: '#10b981',
        borderwidth: 1,
        borderpad: 4
      }
    ],
    plot_bgcolor: '#f8fafc',
    paper_bgcolor: 'rgba(0,0,0,0)'
  };

  const config = {
    responsive: true,
    displayModeBar: false
  };

  Plotly.newPlot(container, traces, layout, config);
}

// 5. Grouped Bar Chart of Cluster indicators
function renderGroupedBarChart() {
  const container = document.getElementById('plotly-cluster-bar');
  if (!container) return;

  const profiles = window.AppStore.profiles;

  // Variables we want to plot averages for
  const variables = ['poverty_pct', 'ipm', 'sanitation_pct', 'food_insecurity_pct', 'ikp'];
  const varNames = ['Kemiskinan (%)', 'IPM', 'Sanitasi (%)', 'Food Insecurity (%)', 'IKP'];

  const traces = profiles.map((p, i) => {
    return {
      x: varNames,
      y: variables.map(v => p[v]),
      name: CLUSTER_NAMES[i].split(': ')[1],
      type: 'bar',
      marker: {
        color: CLUSTER_COLORS[p.cluster],
        opacity: 0.85
      }
    };
  });

  const layout = {
    barmode: 'group',
    margin: { t: 20, b: 40, l: 40, r: 15 },
    hovermode: 'closest',
    legend: {
      orientation: 'h',
      y: -0.15,
      x: 0,
      font: { size: 9, family: 'Inter' }
    },
    xaxis: {
      tickfont: { size: 10, family: 'Inter', weight: 600 }
    },
    yaxis: {
      title: { text: 'Nilai Rata-rata', font: { size: 10, family: 'Inter', weight: 600 } },
      gridcolor: '#e2e8f0'
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

// 6. Synchronized Side-by-Side Map view
function setupLayoutToggle() {
  const btnSingle = document.getElementById('mode-btn-layer');
  const btnComp = document.getElementById('mode-btn-comparison');
  
  const singleLayout = document.getElementById('cluster-single-layout');
  const compLayout = document.getElementById('cluster-comparison-layout');

  if (!btnSingle || !btnComp) return;

  btnSingle.addEventListener('click', () => {
    activeLayout = 'single';
    btnComp.classList.remove('active');
    btnSingle.classList.add('active');

    compLayout.classList.add('hidden');
    singleLayout.classList.remove('hidden');

    destroyComparisonMaps();
    updateSingleMapLayer();
  });

  btnComp.addEventListener('click', () => {
    activeLayout = 'comparison';
    btnSingle.classList.remove('active');
    btnComp.classList.add('active');

    singleLayout.classList.add('hidden');
    compLayout.classList.remove('hidden');

    initComparisonMaps();
  });
}

function initComparisonMaps() {
  if (mapCompLeft || mapCompRight) return;

  console.log("Initializing Synchronized Maps...");

  // Initialize SC-Clustering Map (Left)
  mapCompLeft = L.map('map-comp-cluster', {
    center: [-2.5, 118],
    zoom: 4,
    minZoom: 3,
    maxZoom: 10,
    zoomControl: true
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(mapCompLeft);

  // Initialize LISA Autocorrelation Map (Right)
  mapCompRight = L.map('map-comp-lisa', {
    center: [-2.5, 118],
    zoom: 4,
    minZoom: 3,
    maxZoom: 10,
    zoomControl: false // Right map does not need its own zoom buttons
  });

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; CARTO',
    subdomains: 'abcd',
    maxZoom: 20
  }).addTo(mapCompRight);

  // 1. Draw SC-Clustering features (Left)
  function styleLeft(feature) {
    const c = feature.properties.cluster;
    return {
      fillColor: CLUSTER_COLORS[c] || '#cbd5e1',
      weight: 1.2,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.8
    };
  }

  layerCompLeft = L.geoJSON(window.AppStore.geojson, {
    style: styleLeft,
    onEachFeature: function(feature, layer) {
      layer.on('mouseover', (e) => {
        layer.setStyle({ weight: 2.5, color: '#0f172a' });
        layer.bindTooltip(`<b>${feature.properties.PROVINSI}</b><br>Klaster: ${feature.properties.cluster}`, { sticky: true }).openTooltip();
      });
      layer.on('mouseout', () => { layerCompLeft.resetStyle(layer); });
    }
  }).addTo(mapCompLeft);

  // 2. Draw LISA Hotspot features (Right)
  function styleRight(feature) {
    const props = feature.properties;
    const label = props.lisa_label || 'Not Significant';
    const isSig = props.significance === 'Significant';

    return {
      fillColor: LISA_COLORS[label] || '#cbd5e1',
      weight: isSig ? 2.2 : 1,
      opacity: 1,
      color: isSig ? '#334155' : '#ffffff',
      fillOpacity: 0.8
    };
  }

  layerCompRight = L.geoJSON(window.AppStore.geojson, {
    style: styleRight,
    onEachFeature: function(feature, layer) {
      layer.on('mouseover', (e) => {
        layer.setStyle({ weight: 2.5, color: '#0f172a' });
        layer.bindTooltip(`<b>${feature.properties.PROVINSI}</b><br>LISA: ${feature.properties.lisa_label}`, { sticky: true }).openTooltip();
      });
      layer.on('mouseout', () => { layerCompRight.resetStyle(layer); });
    }
  }).addTo(mapCompRight);

  // 3. SYNCHRONIZE MAPS (Pan & Zoom Linkage)
  mapCompLeft.on('move', () => {
    mapCompRight.setView(mapCompLeft.getCenter(), mapCompLeft.getZoom(), { animate: false });
  });

  mapCompRight.on('move', () => {
    mapCompLeft.setView(mapCompRight.getCenter(), mapCompRight.getZoom(), { animate: false });
  });

  // Fit bounds left first to sync both
  mapCompLeft.fitBounds(layerCompLeft.getBounds());
}

function destroyComparisonMaps() {
  if (mapCompLeft) {
    mapCompLeft.off('move');
    mapCompLeft.remove();
    mapCompLeft = null;
  }
  if (mapCompRight) {
    mapCompRight.off('move');
    mapCompRight.remove();
    mapCompRight = null;
  }
  layerCompLeft = null;
  layerCompRight = null;
}
