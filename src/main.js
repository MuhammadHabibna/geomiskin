// ==========================================================================
// GEOMISKIN — MAINJS (Core App Store, Parallel Loader, Router, and Utils)
// ==========================================================================

import { initOverviewTab, renderOverviewPanel } from './tabs/overview.js';
import { initBivariateTab } from './tabs/bivariate.js';
import { initLisaTab } from './tabs/lisa.js';
import { initClusteringTab } from './tabs/clustering.js';
import { initAboutTab } from './tabs/about.js';

// Global application store
window.AppStore = {
  geojson: null,
  provinces: [],
  profiles: [],
  evaluation: [],
  lisaSummary: null,
  activeTab: 'overview',
  selectedProvId: null, // Holds currently clicked/hovered province key (prov_norm)
  
  // Data anomalies flagged for academic rigor
  anomalies: {
    'jawa timur': {
      field: 'Indeks Ketahanan Pangan (IKP)',
      value: 7.27,
      corrected: 72.7,
      reason: 'Kemungkinan kesalahan desimal di dataset BPS (tercatat 7.27, rata-rata nasional ~70-80, seharusnya 72.7).'
    },
    'banten': {
      field: 'Indeks Ketahanan Pangan (IKP)',
      value: 7.78,
      corrected: 77.8,
      reason: 'Kemungkinan kesalahan desimal di dataset BPS (tercatat 7.78, rata-rata nasional ~70-80, seharusnya 77.8).'
    }
  }
};

// Robust fetch helper with multi-path fallback to support Vite dev server, 
// production build, and traditional web servers (e.g. Live Server, Python http.server)
async function fetchAsset(path) {
  const fallbacks = [
    path,                              // Primary path, e.g. '/data/geojson_38.json'
    `/public${path}`,                  // Fallback for Live Server / python http.server from dashboard/
    `.${path}`,                        // Relative path fallback
    `./public${path}`                  // Relative path with public fallback
  ];

  let lastError = null;
  for (const url of fallbacks) {
    try {
      const resp = await fetch(url);
      if (resp.ok) {
        return resp;
      }
    } catch (e) {
      lastError = e;
    }
  }
  
  throw new Error(`Failed to load asset from ${path}. Last error: ${lastError ? lastError.message : 'Unknown'}`);
}

document.addEventListener('DOMContentLoaded', async () => {
  console.log("GEOMISKIN Dashboard Initializing...");
  
  try {
    // 1. Parallel loading of all integrated JSON assets using the robust fetchAsset helper
    const [geojsonResp, provincesResp, profilesResp, evalResp, lisaResp] = await Promise.all([
      fetchAsset('/data/geojson_38.json'),
      fetchAsset('/data/provinces.json'),
      fetchAsset('/data/cluster_profiles.json'),
      fetchAsset('/data/cluster_evaluation.json'),
      fetchAsset('/data/lisa_summary.json')
    ]);

    window.AppStore.geojson = await geojsonResp.json();
    window.AppStore.provinces = await provincesResp.json();
    window.AppStore.profiles = await profilesResp.json();
    window.AppStore.evaluation = await evalResp.json();
    window.AppStore.lisaSummary = await lisaResp.json();
    
    console.log("All dataset layers loaded successfully:", {
      provincesCount: window.AppStore.provinces.length,
      geojsonFeatures: window.AppStore.geojson.features.length,
      lisaSignificance: window.AppStore.lisaSummary.significance
    });
    
    // Hide Loading screen with smooth fade-out
    const loader = document.getElementById('loading-overlay');
    if (loader) {
      loader.classList.add('hidden');
    }

    // Set default selected province (first one in list, e.g. Aceh or similar)
    if (window.AppStore.provinces.length > 0) {
      window.AppStore.selectedProvId = window.AppStore.provinces[0].prov_norm;
    }

    // 2. Initialize router & setup event listeners
    initRouter();
    
    // 3. Initialize the first tab (Overview)
    triggerTabInit('overview');
    
    // 4. Setup anomaly indicator checking globally
    checkAnomalyBadge();

  } catch (error) {
    console.error("Critical error loading dashboard assets:", error);
    alert("Gagal memuat data spasial.\n\nDetail Error: " + error.message + "\n\nPastikan Anda telah menjalankan server lokal (seperti 'npm run dev' atau server HTTP lain) dan tidak membuka file HTML langsung dengan double-click.");
  }
});

// Tab routing logic
function initRouter() {
  const tabs = document.querySelectorAll('.nav-tab');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.getAttribute('data-tab');
      
      // Update UI active states
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      
      const panels = document.querySelectorAll('.tab-panel');
      panels.forEach(p => p.classList.remove('active'));
      
      const targetPanel = document.getElementById(`tab-${targetTab}`);
      if (targetPanel) {
        targetPanel.classList.add('active');
      }
      
      window.AppStore.activeTab = targetTab;
      console.log(`Switched to tab: ${targetTab}`);
      
      // Initialize tab views on-demand to optimize Leaflet map loading
      triggerTabInit(targetTab);
    });
  });
}

// Lifecycle controller for on-demand tab loading
function triggerTabInit(tabId) {
  switch (tabId) {
    case 'overview':
      initOverviewTab();
      break;
    case 'bivariate':
      initBivariateTab();
      break;
    case 'lisa':
      initLisaTab();
      break;
    case 'clustering':
      initClusteringTab();
      break;
    case 'about':
      initAboutTab();
      break;
  }
}

// Global UI helper: Flag anomalies in sidebar details
export function checkAnomalyBadge() {
  const badgeHolder = document.getElementById('anomaly-badge-holder');
  if (!badgeHolder) return;

  const currentProv = window.AppStore.selectedProvId;
  if (currentProv && window.AppStore.anomalies[currentProv]) {
    const anomaly = window.AppStore.anomalies[currentProv];
    badgeHolder.innerHTML = `
      <div class="anomaly-tag">
        ⚠️ Anomali Data: ${anomaly.field} = ${anomaly.value} (Normal ~${anomaly.corrected})
      </div>
    `;
  } else {
    badgeHolder.innerHTML = '';
  }
}

// Global selector sync: click a province on map/table, update globally
export function selectProvinceGlobal(provId, source) {
  if (!provId) return;
  window.AppStore.selectedProvId = provId;
  console.log(`Global Selection Sync [Source: ${source}]: ${provId}`);
  
  // Flag anomalies on active navbar
  checkAnomalyBadge();

  // Trigger local panel re-renders depending on what tab is active
  if (window.AppStore.activeTab === 'overview') {
    renderOverviewPanel();
  }
}

// Helper: Color Interpolator for Bivariate Maps and Custom Ranges
export function getInterpolatedColor(c1, c2, factor) {
  const hex = x => {
    const s = x.toString(16);
    return s.length === 1 ? '0' + s : s;
  };
  
  const r1 = parseInt(c1.substring(1, 3), 16);
  const g1 = parseInt(c1.substring(3, 5), 16);
  const b1 = parseInt(c1.substring(5, 7), 16);
  
  const r2 = parseInt(c2.substring(1, 3), 16);
  const g2 = parseInt(c2.substring(3, 5), 16);
  const b2 = parseInt(c2.substring(5, 7), 16);
  
  const r = Math.round(r1 + factor * (r2 - r1));
  const g = Math.round(g1 + factor * (g2 - g1));
  const b = Math.round(b1 + factor * (b2 - b1));
  
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

// Helper: Shorten variables to tidy headers
export function formatValue(val, key) {
  if (val === null || val === undefined) return 'N/A';
  if (typeof val === 'string') return val;
  
  // Percentages
  if (key.includes('%') || key.includes('Sektor Pertanian') || key.includes('Konsumsi Pangan') || key.includes('Akses')) {
    return `${val.toFixed(2)}%`;
  }
  // Gini ratio, IPM, IKP
  if (key.includes('Gini') || key.includes('IPM') || key.includes('IKP') || key.includes('zscore') || key.includes('School')) {
    return val.toFixed(3);
  }
  // Rupiah
  if (key.includes('Rupiah') || key.includes('Capita')) {
    return `Rp ${val.toLocaleString('id-ID')}`;
  }
  return val.toLocaleString('id-ID');
}
