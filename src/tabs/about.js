// ==========================================================================
// GEOMISKIN — ABOUT TAB (Dynamic Descriptive Stats of 15 Variables)
// ==========================================================================

import { formatValue } from '../main.js';

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

export function initAboutTab() {
  if (isInitialized) return;
  isInitialized = true;
  console.log("Initializing About Tab...");

  renderDescriptiveStatistics();
}

// Dynamically compute Min, Max, and Average for all 15 variables and inject into UI
function renderDescriptiveStatistics() {
  const table = document.querySelector('.vars-card .vars-body table');
  if (!table) return;

  const data = window.AppStore.provinces;
  if (!data || data.length === 0) return;

  // Let's compute stats for each variable
  const stats = VARIABLES.map(v => {
    const values = data.map(d => d[v]).filter(val => val !== null && val !== undefined);
    
    if (values.length === 0) {
      return { var: v, min: 'N/A', max: 'N/A', avg: 'N/A' };
    }

    const min = Math.min(...values);
    const max = Math.max(...values);
    const sum = values.reduce((s, val) => s + val, 0);
    const avg = sum / values.length;

    return {
      var: v,
      min: min,
      max: max,
      avg: avg
    };
  });

  // Rewrite table innerHTML to include descriptive stats
  table.innerHTML = `
    <thead>
      <tr>
        <th>Indikator</th>
        <th class="text-right">Min</th>
        <th class="text-right">Max</th>
        <th class="text-right">Rata-rata</th>
      </tr>
    </thead>
    <tbody>
      ${stats.map(s => `
        <tr>
          <td><strong>${s.var.split(' (')[0]}</strong></td>
          <td class="text-right">${s.min !== 'N/A' ? formatValue(s.min, s.var) : 'N/A'}</td>
          <td class="text-right">${s.max !== 'N/A' ? formatValue(s.max, s.var) : 'N/A'}</td>
          <td class="text-right">${s.avg !== 'N/A' ? formatValue(s.avg, s.var) : 'N/A'}</td>
        </tr>
      `).join('')}
    </tbody>
  `;
}
