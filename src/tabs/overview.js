// ==========================================================================
// GEOMISKIN — OVERVIEW TAB (Stat Cards, Choropleth Map, Ranking Table)
// ==========================================================================

import { selectProvinceGlobal, formatValue } from '../main.js';

let map = null;
let geojsonLayer = null;
let isInitialized = false;

export function initOverviewTab() {
  if (isInitialized) return;
  isInitialized = true;
  console.log("Initializing Overview Tab...");
  
  renderStatCards();
  renderExtremeRankings();
  initOverviewMap();
  renderOverviewTable();
  renderOverviewPanel();
  setupSearchListener();
}

// 1. Dynamic Stat Cards with smooth count-up animation
function renderStatCards() {
  const container = document.getElementById('overview-stats');
  if (!container) return;

  const data = window.AppStore.provinces;
  if (!data || data.length === 0) return;

  // Calculations
  const totalProv = data.length;
  
  // Average poverty
  const totalPoverty = data.reduce((sum, d) => sum + d['Persentase Penduduk Miskin (%)'], 0);
  const avgPoverty = totalPoverty / totalProv;

  // Poorest and Wealthiest
  let poorest = data[0];
  let wealthiest = data[0];
  
  data.forEach(d => {
    if (d['Persentase Penduduk Miskin (%)'] > poorest['Persentase Penduduk Miskin (%)']) poorest = d;
    if (d['Persentase Penduduk Miskin (%)'] < wealthiest['Persentase Penduduk Miskin (%)']) wealthiest = d;
  });

  container.innerHTML = `
    <div class="stat-card" id="card-total-prov">
      <div class="stat-label">Total Wilayah</div>
      <div class="stat-value" id="val-total-prov">0</div>
      <div class="stat-sub">Provinsi Terintegrasi</div>
    </div>
    <div class="stat-card info-card-style" id="card-avg-pov">
      <div class="stat-label">Rata-rata Kemiskinan</div>
      <div class="stat-value" id="val-avg-pov">0.00%</div>
      <div class="stat-sub">Persentase Nasional</div>
    </div>
    <div class="stat-card poorest-card" id="card-poorest">
      <div class="stat-label">Tingkat Tertinggi</div>
      <div class="stat-value" id="val-poorest">0.00%</div>
      <div class="stat-sub">📍 <span class="stat-sub-val">${poorest.Provinsi}</span></div>
    </div>
    <div class="stat-card wealthiest-card" id="card-wealthiest">
      <div class="stat-label">Tingkat Terendah</div>
      <div class="stat-value" id="val-wealthiest">0.00%</div>
      <div class="stat-sub">📍 <span class="stat-sub-val">${wealthiest.Provinsi}</span></div>
    </div>
  `;

  // Animate values
  animateNumber('val-total-prov', 0, totalProv, 0, 1000);
  animateNumber('val-avg-pov', 0, avgPoverty, 2, 1000, '%');
  animateNumber('val-poorest', 0, poorest['Persentase Penduduk Miskin (%)'], 2, 1000, '%');
  animateNumber('val-wealthiest', 0, wealthiest['Persentase Penduduk Miskin (%)'], 2, 1000, '%');
}

// Count-up helper
function animateNumber(id, start, end, decimals, duration, suffix = '') {
  const obj = document.getElementById(id);
  if (!obj) return;
  
  const startTime = performance.now();
  
  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / duration, 1);
    
    // Easing function (easeOutQuad)
    const factor = progress * (2 - progress);
    const current = start + factor * (end - start);
    
    obj.innerText = current.toFixed(decimals) + suffix;
    
    if (progress < 1) {
      requestAnimationFrame(update);
    } else {
      obj.innerText = end.toFixed(decimals) + suffix;
    }
  }
  
  requestAnimationFrame(update);
}

// 2. Render top 5 and bottom 5 in sidebar
function renderExtremeRankings() {
  const container = document.getElementById('rank-extreme');
  if (!container) return;

  const data = [...window.AppStore.provinces];
  // Sort by poverty descending
  data.sort((a, b) => b['Persentase Penduduk Miskin (%)'] - a['Persentase Penduduk Miskin (%)']);

  const poorest5 = data.slice(0, 5);
  const wealthiest5 = data.slice(-5).reverse(); // lowest is at the end, so reverse to show lowest at top of that card

  let html = `
    <!-- Top 3 Poorest -->
    <div class="rank-title-group">
      <span>Tingkat Kerawanan Tertinggi</span>
      <span>Poverty %</span>
    </div>
  `;

  poorest5.slice(0, 3).forEach((d, i) => {
    // Relative length for progress bar (max is 30% for scaling)
    const percent = (d['Persentase Penduduk Miskin (%)'] / 30) * 100;
    html += `
      <div class="rank-item">
        <span class="rank-number top-num">${i + 1}</span>
        <div class="rank-details">
          <div class="rank-prov-name">${d.Provinsi}</div>
          <div class="rank-bar-bg">
            <div class="rank-bar-fill red" style="width: ${percent}%"></div>
          </div>
        </div>
        <div class="rank-val">${d['Persentase Penduduk Miskin (%)'].toFixed(2)}%</div>
      </div>
    `;
  });

  html += `
    <!-- Top 3 Wealthiest -->
    <div class="rank-title-group" style="margin-top: 1.5rem;">
      <span>Tingkat Kesejahteraan Tertinggi</span>
      <span>Poverty %</span>
    </div>
  `;

  wealthiest5.slice(-3).reverse().forEach((d, i) => {
    const percent = (d['Persentase Penduduk Miskin (%)'] / 30) * 100;
    html += `
      <div class="rank-item">
        <span class="rank-number bottom-num">${i + 1}</span>
        <div class="rank-details">
          <div class="rank-prov-name">${d.Provinsi}</div>
          <div class="rank-bar-bg">
            <div class="rank-bar-fill green" style="width: ${percent}%"></div>
          </div>
        </div>
        <div class="rank-val">${d['Persentase Penduduk Miskin (%)'].toFixed(2)}%</div>
      </div>
    `;
  });

  container.innerHTML = html;
}

// 3. Initialize Overview Leaflet Choropleth Map
function initOverviewMap() {
  if (map) return;
  
  // Center of Indonesia
  map = L.map('map-overview', {
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

  // Poverty Color scale (Yellow-Orange-Red)
  function getColor(d) {
    return d > 25.0 ? '#800026' :
           d > 20.0 ? '#BD0026' :
           d > 15.0 ? '#E31A1C' :
           d > 10.0 ? '#FC4E2A' :
           d > 7.0  ? '#FD8D3C' :
           d > 5.0  ? '#FEB24C' :
           d > 3.0  ? '#FED976' :
                      '#FFEDA0';
  }

  function style(feature) {
    const pov = feature.properties['Persentase Penduduk Miskin (%)'] || 0;
    return {
      fillColor: getColor(pov),
      weight: 1.5,
      opacity: 1,
      color: '#ffffff',
      fillOpacity: 0.8
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
    
    // Dynamic tooltip details
    const props = layer.feature.properties;
    
    // Render brief preview inside tooltip
    layer.bindTooltip(`
      <div class="leaflet-tooltip-geomiskin">
        <div class="tooltip-title">${props.PROVINSI}</div>
        <div class="tooltip-row"><span>Kemiskinan:</span><span class="tooltip-val">${props['Persentase Penduduk Miskin (%)'].toFixed(2)}%</span></div>
        <div class="tooltip-row"><span>IPM:</span><span class="tooltip-val">${props['Indeks Pembangunan Manusia (IPM)'].toFixed(2)}</span></div>
        <div class="tooltip-row"><span>IKP:</span><span class="tooltip-val">${props['Indeks Ketahanan Pangan (IKP)'].toFixed(2)}</span></div>
      </div>
    `, { sticky: true, direction: 'top', className: 'geomiskin-tooltip-custom' }).openTooltip();

    // Hover also updates sidebar
    selectProvinceGlobal(props.prov_norm, 'map-hover');
  }

  function resetHighlight(e) {
    geojsonLayer.resetStyle(e.target);
  }

  function onEachFeature(feature, layer) {
    layer.on({
      mouseover: highlightFeature,
      mouseout: resetHighlight,
      click: (e) => {
        const props = e.target.feature.properties;
        selectProvinceGlobal(props.prov_norm, 'map-click');
        // Fit bounds gracefully
        map.fitBounds(e.target.getBounds());
      }
    });
  }

  // Load geojson
  geojsonLayer = L.geoJSON(window.AppStore.geojson, {
    style: style,
    onEachFeature: onEachFeature
  }).addTo(map);

  // Add custom premium map legend
  const legend = L.control({ position: 'bottomright' });
  legend.onAdd = function () {
    const div = L.DomUtil.create('div', 'legend-control');
    const grades = [0, 3, 5, 7, 10, 15, 20, 25];
    
    div.innerHTML = '<h4>Penduduk Miskin</h4>';
    for (let i = 0; i < grades.length; i++) {
      div.innerHTML += `
        <div class="legend-item">
          <span class="legend-color" style="background:${getColor(grades[i] + 1)}"></span>
          <span>${grades[i]}${grades[i + 1] ? '&ndash;' + grades[i + 1] : '+'}%</span>
        </div>
      `;
    }
    return div;
  };
  legend.addTo(map);
}

// 4. Render Province descriptive table
export function renderOverviewTable(filteredData = null) {
  const tbody = document.querySelector('#overview-table tbody');
  if (!tbody) return;

  const data = filteredData || window.AppStore.provinces;
  
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center">Provinsi tidak ditemukan</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(d => {
    const isPoorest = d.prov_norm === window.AppStore.selectedProvId ? 'style="background-color: var(--primary-glow); font-weight: 600;"' : '';
    const clusterColorClass = `badge-cluster-${d.cluster}`;
    const lisaClass = `badge-lisa-${d.lisa_label.toLowerCase().replace('-', '')}`;
    
    return `
      <tr ${isPoorest} class="province-row" data-id="${d.prov_norm}">
        <td><strong>${d.Provinsi}</strong></td>
        <td class="text-right">${d['Persentase Penduduk Miskin (%)'].toFixed(2)}%</td>
        <td class="text-right">${d['Indeks Pembangunan Manusia (IPM)'].toFixed(2)}</td>
        <td class="text-right">${d['Indeks Ketahanan Pangan (IKP)'].toFixed(2)}</td>
        <td class="text-center"><span class="badge-cluster ${clusterColorClass}">Klaster ${d.cluster}</span></td>
        <td class="text-center"><span class="badge-lisa ${lisaClass}">${d.lisa_label}</span></td>
      </tr>
    `;
  }).join('');

  // Row click listener
  tbody.querySelectorAll('.province-row').forEach(row => {
    row.addEventListener('click', () => {
      const provId = row.getAttribute('data-id');
      selectProvinceGlobal(provId, 'table-click');
      highlightMapProvince(provId);
    });
  });
}

// Highlight map feature on row click
function highlightMapProvince(provId) {
  if (!geojsonLayer || !map) return;

  geojsonLayer.eachLayer(layer => {
    if (layer.feature.properties.prov_norm === provId) {
      // Set highlight styles
      layer.setStyle({
        weight: 3.5,
        color: '#2563eb',
        fillOpacity: 0.95
      });
      // Zoom map
      map.fitBounds(layer.getBounds());
    } else {
      // Reset others
      geojsonLayer.resetStyle(layer);
    }
  });
}

// Setup search filter listener
function setupSearchListener() {
  const searchInput = document.getElementById('overview-search');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase().trim();
    const filtered = window.AppStore.provinces.filter(d => 
      d.Provinsi.toLowerCase().includes(q)
    );
    renderOverviewTable(filtered);
  });
}

// 5. Render sidebar Detail Panel (Overview Panel)
export function renderOverviewPanel() {
  const container = document.getElementById('info-overview');
  if (!container) return;

  const activeId = window.AppStore.selectedProvId;
  const match = window.AppStore.provinces.find(d => d.prov_norm === activeId);

  if (!match) {
    container.innerHTML = `
      <div class="info-placeholder">
        <span class="placeholder-icon">🗺️</span>
        <p>Arahkan kursor atau klik peta/tabel untuk detail provinsi</p>
      </div>
    `;
    return;
  }

  const clusterColors = ['var(--danger)', 'var(--success)', 'var(--info)'];
  const clusterNames = ['Kawasan Rentan & Tertinggal', 'Kawasan Menengah & Berkembang', 'Kawasan Metropolitan Ekstrem'];
  const lisaColors = {
    'High-High': '#ef4444',
    'Low-Low': '#3b82f6',
    'High-Low': '#f97316',
    'Low-High': '#10b981',
    'Not Significant': 'var(--text-muted)'
  };

  const currentClusterName = clusterNames[match.cluster];
  const lisaColor = lisaColors[match.lisa_label] || 'var(--text-muted)';
  
  // Check if this province has anomaly warning
  const isAnomaly = window.AppStore.anomalies[match.prov_norm];
  const anomalyHtml = isAnomaly ? `
    <div style="background-color: var(--danger-light); color: var(--danger); border: 1.5px solid var(--danger-border); padding: 0.6rem 0.8rem; border-radius: var(--radius-sm); font-size: 0.72rem; line-height: 1.4; margin-top: 1rem;">
      <strong>⚠️ Warning Keaslian Data:</strong> ${isAnomaly.reason}
    </div>
  ` : '';

  container.innerHTML = `
    <div class="info-details">
      <div class="info-prov-header">
        <div class="info-prov-title">
          <h3>${match.Provinsi}</h3>
          <span class="card-subtitle">Kode Prov: ${match.KODE_PROV}</span>
        </div>
        <div class="info-prov-badges">
          <span class="badge-cluster" style="background-color: ${clusterColors[match.cluster]}1A; color: ${clusterColors[match.cluster]}; border-color: ${clusterColors[match.cluster]}">
            ${currentClusterName}
          </span>
          <span class="badge-lisa" style="background-color: ${lisaColor}1A; color: ${lisaColor}; border: 1.5px solid ${lisaColor}; margin-top:0.25rem;">
            LISA: ${match.lisa_label}
          </span>
        </div>
      </div>

      <div class="info-grid">
        <div class="info-item">
          <div class="info-item-label">Kemiskinan</div>
          <div class="info-item-val">${match['Persentase Penduduk Miskin (%)'].toFixed(2)}%</div>
        </div>
        <div class="info-item">
          <div class="info-item-label">IPM</div>
          <div class="info-item-val">${match['Indeks Pembangunan Manusia (IPM)'].toFixed(2)}</div>
        </div>
        <div class="info-item">
          <div class="info-item-label">Ketahanan Pangan</div>
          <div class="info-item-val">${match['Indeks Ketahanan Pangan (IKP)'].toFixed(2)}</div>
        </div>
        <div class="info-item">
          <div class="info-item-label">Rata-rata Sekolah</div>
          <div class="info-item-val">${match['Rata-rata Lamanya Sekolah'].toFixed(2)} Thn</div>
        </div>
        <div class="info-item">
          <div class="info-item-label">Kepadatan</div>
          <div class="info-item-val">${match['Kepadatan Penduduk (km²)'].toLocaleString('id-ID')} /km²</div>
        </div>
        <div class="info-item">
          <div class="info-item-label">Gini Ratio</div>
          <div class="info-item-val">${match['Gini Ratio'].toFixed(3)}</div>
        </div>
      </div>
      
      ${anomalyHtml}
    </div>
  `;

  // Update active state in descriptive table
  const tbody = document.querySelector('#overview-table tbody');
  if (tbody) {
    tbody.querySelectorAll('.province-row').forEach(row => {
      if (row.getAttribute('data-id') === activeId) {
        row.style.backgroundColor = 'var(--primary-glow)';
        row.style.fontWeight = '600';
      } else {
        row.style.backgroundColor = '';
        row.style.fontWeight = '';
      }
    });
  }
}
