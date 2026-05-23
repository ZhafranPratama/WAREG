/**
 * WAREG – Wise Asset for Real Economy & Grocery
 * Main JavaScript (Dinamis Terintegrasi Flask & Struktur Murni CSS Figma)
 */

'use strict';

/* ── DOM Content Loaded (Inisialisasi Semua Fungsi) ──────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!getToken() && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
    return;
  }

  // Inisialisasi Fungsi Interaksi UI Bawaan Figma
  initToggles();
  initGroupBuyButtons();
  initAddKitchen();
  initNotifBell();
  animateBars();
  initChartHover();
  initSaveProfile();

  // Muat data user dari backend jika sudah login
  if (getToken()) {
    loadCurrentUser();
  }

  // Inisialisasi Sinkronisasi Data API Flask
  loadDashboardStats();
  loadPriceTrends();
  loadPriceForecast();
  loadMarketComparison();
  handlePantryForm();
  loadPantryItems();
});

/* ── Global Navigation ───────────────────────────────────────────── */
function getToken() {
  return localStorage.getItem('wareg_token');
}

function getAuthHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

let priceTrendCache = [];

function nav(pageId, btn) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.sb-item').forEach(b => b.classList.remove('active'));
  
  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');
  if (btn) btn.classList.add('active');
}

function formatInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function loadCurrentUser() {
  fetch('/api/auth/me', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    .then(async res => {
      if (!res.ok) {
        throw new Error('Token invalid');
      }
      return res.json();
    })
    .then(user => {
      const initialsEl = document.getElementById('sidebar-user-initials');
      const sideNameEl = document.getElementById('sidebar-user-name');
      const sideLocationEl = document.getElementById('sidebar-user-location');
      const greetingNameEl = document.getElementById('greeting-user-name');
      const accountProfileName = document.getElementById('account-profile-name');
      const accountProfileLocation = document.getElementById('account-profile-location');
      const accountNameInput = document.getElementById('account-name-input');
      const accountEmailInput = document.getElementById('account-email-input');
      const accountLocationInput = document.getElementById('account-location-input');
      const accountPersonaSelect = document.getElementById('account-persona-select');

      const initials = formatInitials(user.full_name);
      if (initialsEl) initialsEl.textContent = initials;
      const accountProfileInitials = document.getElementById('account-profile-initials');
      if (sideNameEl) sideNameEl.textContent = user.full_name;
      if (sideLocationEl) sideLocationEl.textContent = user.location_name || 'Jakarta Selatan';
      if (greetingNameEl) greetingNameEl.textContent = user.full_name;
      if (accountProfileInitials) accountProfileInitials.textContent = initials;
      if (accountProfileName) accountProfileName.textContent = user.full_name;
      if (accountProfileLocation) accountProfileLocation.textContent = `📍 ${user.location_name || 'Jakarta Selatan'}`;
      if (accountNameInput) accountNameInput.value = user.full_name;
      if (accountEmailInput) accountEmailInput.value = user.email;
      if (accountLocationInput) accountLocationInput.value = user.location_name || 'Jakarta Selatan';
      if (accountPersonaSelect) accountPersonaSelect.value = user.persona || 'other';
    })
    .catch(() => {
      localStorage.removeItem('wareg_token');
      if (window.location.pathname !== '/login' && window.location.pathname !== '/register') {
        window.location.href = '/login';
      }
    });
}

async function saveProfile() {
  const accountNameInput = document.getElementById('account-name-input');
  const accountEmailInput = document.getElementById('account-email-input');
  const accountLocationInput = document.getElementById('account-location-input');
  const accountPersonaSelect = document.getElementById('account-persona-select');

  if (!accountNameInput || !accountEmailInput || !accountLocationInput || !accountPersonaSelect) {
    return false;
  }

  const profileData = {
    full_name: accountNameInput.value.trim(),
    email: accountEmailInput.value.trim(),
    location_name: accountLocationInput.value.trim(),
    persona: accountPersonaSelect.value,
  };

  const response = await fetch('/api/auth/me', {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
    },
    body: JSON.stringify(profileData),
  });

  if (!response.ok) {
    if (response.status === 401) {
      localStorage.removeItem('wareg_token');
      window.location.href = '/login';
      return false;
    }
    const error = await response.json().catch(() => ({ error: 'Gagal menyimpan profil' }));
    console.error(error);
    return false;
  }

  loadCurrentUser();
  return true;
}

/* ── 1. DASHBOARD: Memuat Angka Ringkasan Statistik ──────────────── */
function loadDashboardStats() {
  fetch('/api/commodity', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    .then(res => res.ok ? res.json() : [])
    .then(data => {
      const beras = data.find(item => item.commodity_name.toLowerCase().includes('beras'));
      const hargaBerasEl = document.getElementById('dash-harga-beras');
      
      if (beras && hargaBerasEl) {
        hargaBerasEl.innerHTML = `Rp ${Number(beras.price_value).toLocaleString('id-ID')}<span class="stat-unit">/${beras.unit}</span>`;
      } else if (hargaBerasEl) {
        hargaBerasEl.innerHTML = `Rp 0<span class="stat-unit">/kg</span>`;
      }

      const totalPantryEl = document.getElementById('dash-total-pantry');
      if (totalPantryEl) {
        totalPantryEl.innerHTML = `${data.length}<span class="stat-unit"> item</span>`;
      }
    })
    .catch(err => console.error("Gagal memuat statistik dashboard:", err));
}

/* ── 2. PRICE TRENDS: Ringkasan tren per komoditas + grafik dinamis ── */
function formatTrendDate(dateValue) {
  if (!dateValue) return 'N/A';
  const date = new Date(dateValue);
  if (Number.isNaN(date.getTime())) return String(dateValue);
  return date.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
}

function renderTrendCharts(selectedCommodity) {
  const chartContainer = document.getElementById('trend-chart-container');
  const selectEl = document.getElementById('trend-chart-select');

  if (!chartContainer) return;

  if (!priceTrendCache.length) {
    chartContainer.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Belum ada data tren harga untuk ditampilkan.</p>';
    return;
  }

  const selected = priceTrendCache.some(item => item.commodity_name === selectedCommodity)
    ? selectedCommodity
    : priceTrendCache[0].commodity_name;

  if (selectEl && selected) {
    selectEl.value = selected;
  }

  const charts = priceTrendCache.map(item => {
    const history = item.records.slice(-10);

    if (!history.length) {
      return `
        <div class="trend-area trend-chart-card">
          <div class="card-title" style="margin-bottom:8px">${item.commodity_name}</div>
          <p style="padding:16px 0 0;color:var(--text3);margin:0">Data historis untuk komoditas ini belum tersedia.</p>
        </div>
      `;
    }

    const prices = history.map(record => record.price_value);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const avgPrice = prices.reduce((sum, value) => sum + value, 0) / prices.length;

    const bars = history.map(record => {
      const height = maxPrice === minPrice ? 50 : ((record.price_value - minPrice) / (maxPrice - minPrice)) * 80 + 10;
      const label = formatTrendDate(record.recorded_date);
      return `<div class="lc-bar" title="${label}: Rp ${Number(record.price_value).toLocaleString('id-ID')}" style="height:${height}%"></div>`;
    }).join('');

    const labels = history.map(record => `<span class="lc-lbl">${formatTrendDate(record.recorded_date)}</span>`).join('');
    const trendColor = item.trend === 'up' ? 'var(--red)' : item.trend === 'down' ? 'var(--g2)' : 'var(--text3)';
    const trendBadge = item.trend === 'up' ? 'pill-buy' : item.trend === 'down' ? 'pill-wait' : 'pill-watch';
    const changeText = item.percentage !== 0 ? `${item.percentage > 0 ? '+' : ''}${item.percentage.toFixed(1)}%` : '0.0%';

    return `
      <div class="trend-area trend-chart-card ${item.commodity_name === selected ? 'is-selected' : ''}">
        <div class="card-title" style="margin-bottom:8px">${item.commodity_name}</div>
        <div class="trend-chart-meta">
          <span>${item.source} • ${item.latestDate}</span>
          <span class="pred-pill ${trendBadge}">${item.trendLabel} ${changeText}</span>
        </div>
        <div class="trend-labels">
          <div class="tl-item"><div class="tl-dot" style="background:${trendColor}"></div>Harga aktual</div>
        </div>
        <div class="line-chart" style="height:80px">${bars}</div>
        <div class="lc-labels">${labels}</div>
        <div class="trend-chart-summary">
          <div><span>Min</span><strong>Rp ${Number(minPrice).toLocaleString('id-ID')}</strong></div>
          <div><span>Maks</span><strong>Rp ${Number(maxPrice).toLocaleString('id-ID')}</strong></div>
          <div><span>Rata-rata</span><strong>Rp ${Number(avgPrice).toLocaleString('id-ID')}</strong></div>
          <div><span>Terbaru</span><strong>Rp ${Number(item.currentPrice).toLocaleString('id-ID')}</strong></div>
        </div>
      </div>
    `;
  }).join('');

  chartContainer.innerHTML = `<div class="trend-chart-grid">${charts}</div>`;
}

function loadPriceTrends() {
  fetch('/api/commodity', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    .then(res => res.ok ? res.json() : [])
    .then(data => {
      const container = document.getElementById('trends-list-container');
      const selectEl = document.getElementById('trend-chart-select');
      const chartContainer = document.getElementById('trend-chart-container');
      if (!container) return;

      container.innerHTML = '';

      if (!Array.isArray(data) || data.length === 0) {
        container.innerHTML = '<p style="padding: 16px; color: var(--text3);">Belum ada data tren harga di SQLite. Silakan isi form di tab Digital Kitchen.</p>';
        if (chartContainer) chartContainer.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Belum ada data tren harga untuk tampilkan.</p>';
        priceTrendCache = [];
        return;
      }

      const grouped = new Map();
      data.forEach(item => {
        const key = item.commodity_name;
        if (!grouped.has(key)) {
          grouped.set(key, []);
        }
        grouped.get(key).push({
          price_value: Number(item.price_value),
          recorded_date: item.recorded_date,
          source: item.source,
        });
      });

      const commodityRows = Array.from(grouped.entries()).map(([commodity_name, records]) => {
        const sortedRecords = records
          .slice()
          .sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));

        const latest = sortedRecords[sortedRecords.length - 1];
        const previous = sortedRecords[sortedRecords.length - 2];
        const currentPrice = latest?.price_value ?? 0;

        let percentage = 0;
        let trend = 'steady';
        let trendLabel = 'Stabil';

        if (previous && previous.price_value !== 0) {
          percentage = ((currentPrice - previous.price_value) / previous.price_value) * 100;
          trend = percentage > 0 ? 'up' : percentage < 0 ? 'down' : 'steady';
          trendLabel = trend === 'up' ? 'Naik' : trend === 'down' ? 'Turun' : 'Stabil';
        }

        return {
          commodity_name,
          currentPrice,
          percentage,
          trend,
          trendLabel,
          latestDate: latest?.recorded_date || 'Tidak tersedia',
          source: latest?.source || 'Sumber tidak tersedia',
          records: sortedRecords,
        };
      });

      priceTrendCache = commodityRows;

      const maxPrice = Math.max(...commodityRows.map(item => item.currentPrice), 1);

      commodityRows.forEach(item => {
        const barWidth = Math.min((item.currentPrice / maxPrice) * 100, 100);
        const trendColor = item.trend === 'up' ? 'var(--red)' : item.trend === 'down' ? 'var(--g2)' : 'var(--text3)';
        const trendBadge = item.trend === 'up' ? 'pill-buy' : item.trend === 'down' ? 'pill-wait' : 'pill-watch';

        const trendHTML = `
          <div class="trend-item">
            <div class="trend-name">
              <strong>${item.commodity_name}</strong>
              <span class="trend-meta">${item.source} • ${item.latestDate}</span>
            </div>
            <div class="trend-graph">
              <div class="tg-bar" style="width: ${barWidth}%; background: ${trendColor};"></div>
            </div>
            <div class="trend-val">
              <span class="t-current">Rp ${Number(item.currentPrice).toLocaleString('id-ID')}</span>
              <span class="pred-pill ${trendBadge}" style="margin-top: 6px;">${item.trendLabel} ${item.percentage !== 0 ? `${item.percentage > 0 ? '+' : ''}${item.percentage.toFixed(1)}%` : '0.0%'}</span>
            </div>
          </div>
        `;

        container.insertAdjacentHTML('beforeend', trendHTML);
      });

      if (selectEl) {
        selectEl.innerHTML = commodityRows.map(item => `<option value="${item.commodity_name}">${item.commodity_name}</option>`).join('');
        selectEl.onchange = () => renderTrendCharts(selectEl.value);
      }

      renderTrendCharts(selectEl?.value || commodityRows[0]?.commodity_name);
    })
    .catch(err => console.error("Gagal memuat visualisasi tren harga:", err));
}

/* ── 3. DIGITAL KITCHEN: Sinkronisasi Grid Card Sesuai CSS Figma ── */
function loadPantryItems() {
  fetch('/api/commodity', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    }) 
    .then(res => res.ok ? res.json() : [])
    .then(data => {
      const container = document.getElementById('pantry-items-container');
      if (!container) return;

      container.innerHTML = ''; 

      if (data.length === 0) {
        container.innerHTML = '<p style="padding: 20px; color: var(--text3); grid-column: 1/-1;">Dapur kosong. Masukkan komoditas melalui formulir input.</p>';
        return;
      }

      data.forEach(item => {
        // Menggunakan murni susunan class .pantry-card, .p-head, .p-title, .p-body, .p-info dari style.css asli kamu
        const itemHTML = `
          <div class="pantry-card">
            <div class="p-head">
              <span class="p-title">${item.commodity_name}</span>
              <span class="badge badge-success">1 ${item.unit}</span>
            </div>
            <div class="p-body">
              <div class="p-info">Pasar: <strong>${item.source}</strong></div>
              <div class="p-info" style="margin-top: 4px;">Harga: <strong style="color: var(--g2);">Rp ${Number(item.price_value).toLocaleString('id-ID')}</strong></div>
            </div>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
      });
    })
    .catch(err => console.error("Gagal memuat list dapur:", err));
}

function formatRupiah(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '--';
  }
  return Number(value).toLocaleString('id-ID');
}

function getDisplayCommodityName(name) {
  if (!name) return 'Komoditas';

  const normalized = String(name).toLowerCase();
  if (normalized.includes('cabai') || normalized.includes('chili')) return 'Cabai Merah';
  if (normalized.includes('bawang') || normalized.includes('garlic')) return 'Bawang Putih';
  if (normalized.includes('tomat') || normalized.includes('tomato')) return 'Tomat';
  if (normalized.includes('beras') || normalized.includes('rice')) return 'Beras';
  if (normalized.includes('telur') || normalized.includes('egg')) return 'Telur';
  if (normalized.includes('daging') || normalized.includes('beef') || normalized.includes('meat')) return 'Daging Sapi';
  if (normalized.includes('minyak') || normalized.includes('oil')) return 'Minyak Sayur';
  if (normalized.includes('gula') || normalized.includes('sugar')) return 'Gula';
  return String(name);
}

function getForecastAlias(name) {
  if (!name) return null;

  const normalized = String(name).toLowerCase();
  if (normalized.includes('cabai') || normalized.includes('chili')) return 'Chili (Red)';
  if (normalized.includes('beras') || normalized.includes('rice')) return 'Rice';
  if (normalized.includes('telur') || normalized.includes('egg')) return 'Eggs';
  if (normalized.includes('daging') || normalized.includes('beef') || normalized.includes('meat')) return 'Meat (Beef)';
  if (normalized.includes('minyak') || normalized.includes('oil')) return 'Oil (Vegetable)';
  if (normalized.includes('gula') || normalized.includes('sugar')) return 'Sugar';
  return null;
}

function buildDailySeries(currentPrice, predictedPrice) {
  const current = Number(currentPrice) || 0;
  const target = Number(predictedPrice) || current;
  const step = (target - current) / 4;

  return Array.from({ length: 5 }, (_, index) => Math.max(0, current + step * index));
}

function sortHistory(records = []) {
  return records
    .slice()
    .filter(record => Number.isFinite(Number(record.price_value)))
    .sort((a, b) => new Date(a.recorded_date) - new Date(b.recorded_date));
}

function getSafeForecastValues(records = [], payload = {}) {
  const sortedRecords = sortHistory(records);
  const latestPrice = sortedRecords.length > 0 ? Number(sortedRecords[sortedRecords.length - 1].price_value) : 0;
  const previousPrice = sortedRecords.length > 1 ? Number(sortedRecords[sortedRecords.length - 2].price_value) : latestPrice;
  const currentPrice = Number(payload.current_price) > 0 ? Number(payload.current_price) : latestPrice;
  const predictedPrice = Number(payload.predicted_price) > 0 ? Number(payload.predicted_price) : currentPrice;
  const trendDelta = sortedRecords.length > 1 ? (latestPrice - previousPrice) / Math.max(sortedRecords.length - 1, 1) : 0;
  const fallbackPredicted = latestPrice + trendDelta * 4;
  const safePredicted = Number.isFinite(predictedPrice) && predictedPrice > 0 ? predictedPrice : fallbackPredicted;

  return {
    currentPrice,
    predictedPrice: safePredicted,
    trendDelta,
  };
}

function buildFallbackForecast(name, records = []) {
  const sortedRecords = sortHistory(records);
  const latestPrice = sortedRecords.length > 0 ? Number(sortedRecords[sortedRecords.length - 1].price_value) : 0;
  const previousPrice = sortedRecords.length > 1 ? Number(sortedRecords[sortedRecords.length - 2].price_value) : latestPrice;
  const trendDelta = sortedRecords.length > 1 ? (latestPrice - previousPrice) / Math.max(sortedRecords.length - 1, 1) : 0;
  const predictedPrice = latestPrice + trendDelta * 4;
  const trend = predictedPrice > latestPrice ? 'up' : predictedPrice < latestPrice ? 'down' : 'steady';
  const percentage = latestPrice ? Math.round(Math.abs(predictedPrice - latestPrice) / latestPrice * 100) : 0;

  return {
    commodity_name: getDisplayCommodityName(name),
    current_price: latestPrice,
    predicted_price: predictedPrice,
    trend,
    percentage,
    recommendation: trend === 'up' ? 'Beli sekarang' : trend === 'down' ? 'Tunda pembelian' : 'Pantau harga',
    sourceLabel: 'Trend lokal',
    isAi: false,
    series: buildDailySeries(latestPrice, predictedPrice),
  };
}

function buildForecastSummaryCardMarkup(item) {
  const trendColor = item.trend === 'down' ? 'var(--g2)' : item.trend === 'up' ? 'var(--red)' : 'var(--text3)';
  const trendLabel = item.trend === 'down' ? 'Turun' : item.trend === 'up' ? 'Naik' : 'Stabil';
  const trendBadge = item.trend === 'up' ? 'pill-buy' : item.trend === 'down' ? 'pill-wait' : 'pill-watch';
  const changeText = item.percentage !== 0 ? `${item.trend === 'up' ? '+' : '-'}${item.percentage}%` : '0%';

  return `
    <div class="trend-area forecast-summary-card">
      <div class="forecast-item-head">
        <div>
          <div class="forecast-item-title">${item.commodity_name}</div>
          <div class="forecast-item-meta">${item.sourceLabel}</div>
        </div>
        <span class="pred-pill ${trendBadge}" style="white-space:nowrap;">${trendLabel} ${changeText}</span>
      </div>
      <div class="forecast-summary">
        <div>
          <div class="forecast-subtitle">Saat ini</div>
          <div class="forecast-value">Rp ${formatRupiah(item.current_price)}</div>
        </div>
        <div>
          <div class="forecast-subtitle">H+4</div>
          <div class="forecast-value" style="color:${trendColor}">Rp ${formatRupiah(item.predicted_price)}</div>
        </div>
      </div>
      <div class="forecast-footer">
        <span>${item.recommendation}</span>
        <span>Rp ${formatRupiah(item.current_price)} → Rp ${formatRupiah(item.predicted_price)}</span>
      </div>
    </div>
  `;
}

function buildForecastChartCardMarkup(item) {
  const trendColor = item.trend === 'down' ? 'var(--g2)' : item.trend === 'up' ? 'var(--red)' : 'var(--text3)';
  const trendLabel = item.trend === 'down' ? 'Turun' : item.trend === 'up' ? 'Naik' : 'Stabil';
  const trendBadge = item.trend === 'up' ? 'pill-buy' : item.trend === 'down' ? 'pill-wait' : 'pill-watch';
  const changeText = item.percentage !== 0 ? `${item.trend === 'up' ? '+' : '-'}${item.percentage}%` : '0%';
  const minPrice = Math.min(...item.series);
  const maxPrice = Math.max(...item.series);

  const bars = item.series.map((value) => {
    const height = maxPrice === minPrice ? 50 : ((value - minPrice) / (maxPrice - minPrice)) * 80 + 10;
    return `<div class="lc-bar" title="Rp ${formatRupiah(value)}" style="height:${height}%"></div>`;
  }).join('');

  const labels = ['Hari ini', 'D+1', 'D+2', 'D+3', 'D+4'].map(label => `<span class="lc-lbl">${label}</span>`).join('');

  return `
    <div class="trend-area forecast-chart-item">
      <div class="forecast-item-head">
        <div>
          <div class="forecast-item-title">${item.commodity_name}</div>
          <div class="forecast-item-meta">${item.sourceLabel}</div>
        </div>
        <span class="pred-pill ${trendBadge}" style="white-space:nowrap;">${trendLabel} ${changeText}</span>
      </div>
      <div class="line-chart" style="height:80px;margin-top:12px">${bars}</div>
      <div class="lc-labels">${labels}</div>
      <div class="forecast-footer">
        <span style="color:${trendColor}">Rp ${formatRupiah(item.current_price)} → Rp ${formatRupiah(item.predicted_price)}</span>
        <span>${item.recommendation}</span>
      </div>
    </div>
  `;
}

async function loadPriceForecast() {
  try {
    const response = await fetch('/api/commodity', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    if (!response.ok) {
      throw new Error('Tidak dapat mengambil data komoditas');
    }

    const data = await response.json();
    const forecastBody = document.getElementById('predictor-forecast-body');

    if (!forecastBody) return;

    if (!Array.isArray(data) || data.length === 0) {
      forecastBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Belum ada data komoditas untuk lakukan prediksi.</p>';
      return;
    }

    const grouped = new Map();
    data.forEach(item => {
      const key = String(item.commodity_name || '').trim();
      if (!key) return;
      if (!grouped.has(key)) {
        grouped.set(key, []);
      }
      grouped.get(key).push({
        price_value: Number(item.price_value),
        recorded_date: item.recorded_date,
      });
    });

    const commodityNames = Array.from(grouped.keys());
    const priority = ['Cabai Merah', 'Bawang Putih', 'Tomat', 'Beras'];

    const forecastResults = await Promise.all(commodityNames.map(async (commodityName) => {
      const history = grouped.get(commodityName) || [];
      const alias = getForecastAlias(commodityName);
      const safeHistory = sortHistory(history);

      if (!alias) {
        return buildFallbackForecast(commodityName, safeHistory);
      }

      try {
        const forecastResponse = await fetch(`/api/predictor/forecast?commodity=${encodeURIComponent(alias)}`);
        if (!forecastResponse.ok) {
          throw new Error('Prediksi AI gagal');
        }

        const forecastData = await forecastResponse.json();
        const payload = forecastData.data || {};
        const { currentPrice, predictedPrice } = getSafeForecastValues(safeHistory, payload);
        const trend = payload.trend || (predictedPrice > currentPrice ? 'up' : predictedPrice < currentPrice ? 'down' : 'steady');
        const percentage = Number(payload.percentage ?? (currentPrice ? Math.round(Math.abs(predictedPrice - currentPrice) / currentPrice * 100) : 0));

        return {
          commodity_name: getDisplayCommodityName(commodityName),
          current_price: currentPrice,
          predicted_price: predictedPrice,
          trend,
          percentage,
          recommendation: payload.recommendation || (trend === 'up' ? 'Beli sekarang' : trend === 'down' ? 'Tunda pembelian' : 'Pantau harga'),
          sourceLabel: 'Backend AI',
          isAi: true,
          series: buildDailySeries(currentPrice, predictedPrice),
        };
      } catch (error) {
        console.warn(`Fallback prediksi untuk ${commodityName}:`, error);
        return buildFallbackForecast(commodityName, safeHistory);
      }
    }));

    const sortedForecasts = forecastResults.sort((a, b) => {
      const aPriority = priority.indexOf(a.commodity_name);
      const bPriority = priority.indexOf(b.commodity_name);
      if (aPriority === -1 && bPriority === -1) return a.commodity_name.localeCompare(b.commodity_name);
      if (aPriority === -1) return 1;
      if (bPriority === -1) return -1;
      return aPriority - bPriority;
    });

    const summaryCards = sortedForecasts
      .filter(item => Number.isFinite(Number(item.current_price)) && Number(item.current_price) > 0)
      .map(buildForecastSummaryCardMarkup)
      .join('');

    const chartCards = sortedForecasts
      .filter(item => Number.isFinite(Number(item.current_price)) && Number(item.current_price) > 0)
      .map(buildForecastChartCardMarkup)
      .join('');

    forecastBody.innerHTML = `<div class="forecast-grid">${summaryCards}</div>`;
    const chartBody = document.getElementById('predictor-chart-body');
    if (chartBody) {
      chartBody.innerHTML = `<div class="forecast-chart-grid">${chartCards}</div>`;
    }
  } catch (error) {
    console.error('Gagal memuat prediksi harga:', error);
    const forecastBody = document.getElementById('predictor-forecast-body');
    if (forecastBody) {
      forecastBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Prediksi tidak tersedia saat ini.</p>';
    }
    const chartBody = document.getElementById('predictor-chart-body');
    if (chartBody) {
      chartBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Grafik prediksi tidak tersedia saat ini.</p>';
    }
  }
}

function loadMarketComparison() {
  fetch('/api/predictor/compare?commodity=Chili%20(Red)&region_id=1')
    .then(res => res.ok ? res.json() : Promise.reject('Tidak dapat mengambil rekomendasi pasar'))
    .then(result => {
      const data = result.data || {};
      const marketBody = document.getElementById('market-compare-body');
      if (!marketBody) return;

      const items = data.recommendations || [];
      if (items.length === 0) {
        marketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Rekomendasi pasar tidak tersedia saat ini.</p>';
        return;
      }

      let html = '<div style="display:grid;gap:12px">';
      items.slice(0, 4).forEach(item => {
        const price = item.predicted_price ? Number(item.predicted_price).toLocaleString('id-ID') : '--';
        const distance = item.distance ? item.distance.toFixed(1) : '--';
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border-radius:14px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${item.market}</div>
              <div style="font-size:12px;color:var(--text3)">Jarak ${distance} km</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--g2)">Rp ${price}</div>
          </div>`;
      });
      html += '</div>';
      html += `<div style="margin-top:14px;font-size:13px;color:var(--text3)">${data.recommendation || 'Rekomendasi dihitung oleh model AI.'}</div>`;
      marketBody.innerHTML = html;
    })
    .catch(err => {
      console.error('Gagal memuat rekomendasi pasar:', err);
      const marketBody = document.getElementById('market-compare-body');
      if (marketBody) {
        marketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Rekomendasi pasar tidak tersedia.</p>';
      }
    });
}

function loadMarketComparison() {
  fetch('/api/predictor/compare?commodity=Chili%20(Red)&region_id=1')
    .then(res => res.ok ? res.json() : Promise.reject('Tidak dapat mengambil rekomendasi pasar'))
    .then(result => {
      const data = result.data || {};
      const marketBody = document.getElementById('market-compare-body');
      if (!marketBody) return;

      const items = data.recommendations || [];
      if (items.length === 0) {
        marketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Rekomendasi pasar tidak tersedia saat ini.</p>';
        return;
      }

      let html = '<div style="display:grid;gap:12px">';
      items.slice(0, 4).forEach(item => {
        const price = item.predicted_price ? Number(item.predicted_price).toLocaleString('id-ID') : '--';
        const distance = item.distance ? item.distance.toFixed(1) : '--';
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border-radius:14px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${item.market}</div>
              <div style="font-size:12px;color:var(--text3)">Jarak ${distance} km</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--g2)">Rp ${price}</div>
          </div>`;
      });
      html += '</div>';
      html += `<div style="margin-top:14px;font-size:13px;color:var(--text3)">${data.recommendation || 'Rekomendasi dihitung oleh model AI.'}</div>`;
      marketBody.innerHTML = html;
    })
    .catch(err => {
      console.error('Gagal memuat rekomendasi pasar:', err);
      const marketBody = document.getElementById('market-compare-body');
      if (marketBody) {
        marketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Rekomendasi pasar tidak tersedia.</p>';
      }
    });
}

/* ── 4. FORM HANDLING: Tangkap Event POST ────────────────────────── */
function handlePantryForm() {
  const form = document.getElementById('form-add-commodity');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault(); 

    const name = document.getElementById('input-comm-name').value;
    const price = document.getElementById('input-comm-price').value;
    const source = document.getElementById('input-comm-source').value;

    const payload = {
      commodity_name: name,
      category: "Bahan Pokok",
      region_id: 1,
      price_value: parseFloat(price),
      unit: "kg",
      price_type: "retail",
      recorded_date: new Date().toISOString().split('T')[0], 
      source: source
    };

    fetch('/api/commodity', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload)
    })
    .then(res => {
      if (!res.ok) throw new Error("Gagal menyimpan ke basis data.");
      return res.json();
    })
    .then(result => {
      alert("Sukses! Data komoditas pangan berhasil disimpan ke file wareg.db");
      form.reset(); 
      
      // Sinkronisasi ulang data di layar secara instan
      loadDashboardStats();
      loadPriceTrends();
      loadPantryItems();
    })
    .catch(err => alert("Gagal memproses penyimpanan data: " + err));
  });
}

/* ── Fungsi Interaksi UI Bawaan Figma (Pertahankan Utuh) ─────────── */
function initToggles() {
  document.querySelectorAll('.toggle-wrap').forEach(toggle => {
    toggle.addEventListener('click', () => {
      toggle.classList.toggle('on');
      toggle.classList.toggle('off');
    });
  });
}

function initGroupBuyButtons() {
  document.querySelectorAll('.gb-join-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const original = this.textContent;
      this.textContent = '✓ Joined!';
      this.disabled = true;
      this.style.opacity = '0.6';
      setTimeout(() => {
        this.textContent = original;
        this.disabled = false;
        this.style.opacity = '';
      }, 2000);
    });
  });
}

function initAddKitchen() {
  const btn = document.querySelector('.add-kitchen-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    nav('pantry'); 
  });
}

/* ── Klik Bell Notifikasi ── */
function initNotifBell() {
  const bell = document.querySelector('.notif-btn');
  if (!bell) return;
  bell.addEventListener('click', () => {
    const dot = bell.querySelector('.notif-dot');
    if (dot) dot.style.display = 'none';
  });
}

/* ── Animasi Bar Bawaan ── */
function animateBars() {
  document.querySelectorAll('.s-fill, .gb-fill').forEach(bar => {
    const target = bar.style.width;
    bar.style.width = '0';
    requestAnimationFrame(() => {
      setTimeout(() => {
        bar.style.transition = 'width 0.6s ease';
        bar.style.width = target;
      }, 100);
    });
  });
}

function initChartHover() {
  document.querySelectorAll('.lc-bar').forEach(bar => {
    bar.title = 'Harga pada periode ini';
  });
}

function initSaveProfile() {
  const saveBtn = document.querySelector('.save-profile-btn');
  if (!saveBtn) return;
  saveBtn.addEventListener('click', async (event) => {
    event.preventDefault();
    const original = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Menyimpan...';

    const success = await saveProfile();
    if (success) {
      saveBtn.textContent = '✓ Tersimpan!';
      saveBtn.style.background = '#059669';
    } else {
      saveBtn.textContent = 'Gagal simpan';
      saveBtn.style.background = '#dc2626';
    }

    setTimeout(() => {
      saveBtn.textContent = original;
      saveBtn.style.background = '';
      saveBtn.disabled = false;
    }, 2000);
  });
}

function logout() {
  localStorage.removeItem('wareg_token');
  window.location.href = '/login';
}