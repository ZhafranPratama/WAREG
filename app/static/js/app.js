/**
 * WAREG – Wise Asset for Real Economy & Grocery
 * Main JavaScript (Dinamis Terintegrasi Flask & Struktur Murni CSS Figma)
 */

'use strict';

function getToken() {
  return localStorage.getItem('wareg_token');
}

/* ── DOM Content Loaded (Inisialisasi Semua Fungsi) ──────────────── */
document.addEventListener('DOMContentLoaded', () => {
  if (!getToken() && window.location.pathname !== '/login' && window.location.pathname !== '/register') {
    window.location.href = '/login';
    return;
  }

  // Inisialisasi Fungsi Interaksi UI Bawaan Figma
  initToggles();
  initAddKitchen();
  initNotifBell();
  animateBars();
  initChartHover();
  initSaveProfile();
  if (typeof populateLocationSelect === 'function') {
    populateLocationSelect('account-location');
  }

  // Muat data user dari backend jika sudah login
  if (getToken()) {
    loadCurrentUser();
  }

  // Inisialisasi Sinkronisasi Data API Flask
  loadDashboardStats();
  loadPriceTrends();
  loadPriceForecast();
  loadMarketComparison();
  loadMarketRegions();
  handlePantryForm();
  handleImportExcel();
  loadPantryItems();
  try { renderPriceHeadlines(); } catch(e){}
  
});

function getAuthHeaders() {
  const token = getToken();
  return token ? { 'Authorization': `Bearer ${token}` } : {};
}

let priceTrendCache = [];
let priceForecastCache = [];
let priceTrendsLoaded = false;
let priceForecastLoaded = false;
let priceHeadlinesError = false;
let currentUserRegionId = 1;
let currentUserLocationName = 'Jakarta Selatan';
let marketRegionsList = [];

function updateUserLocationWidgets() {
  const dashboardLocationEl = document.getElementById('dashboard-location');
  const dashboardRecommendationEl = document.getElementById('dashboard-market-recommendation');
  const sideLocationEl = document.getElementById('sidebar-user-location');
  const accountProfileLocation = document.getElementById('account-profile-location');

  if (dashboardLocationEl) {
    dashboardLocationEl.textContent = currentUserLocationName || 'Jakarta Selatan';
  }
  if (sideLocationEl) {
    sideLocationEl.textContent = currentUserLocationName || 'Jakarta Selatan';
  }
  if (accountProfileLocation) {
    accountProfileLocation.textContent = `📍 ${currentUserLocationName || 'Jakarta Selatan'}`;
  }

  if (dashboardRecommendationEl) {
    dashboardRecommendationEl.textContent = currentUserLocationName ? `Untuk ${currentUserLocationName}` : 'Memuat...';
  }
}

function findRegionIdByLocationName(locationName, regions = []) {
  if (!locationName || !regions.length) return null;
  const normalized = locationName.trim().toLowerCase();

  const exact = regions.find(r => r.name.trim().toLowerCase() === normalized);
  if (exact) return exact.id;

  const partial = regions.find(r => {
    const regionName = r.name.trim().toLowerCase();
    return normalized.includes(regionName) || regionName.includes(normalized);
  });
  if (partial) return partial.id;

  const locationTokens = normalized.split(/\s+/).filter(Boolean);
  for (const region of regions) {
    const regionTokens = region.name.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (locationTokens.some(token => regionTokens.includes(token))) {
      return region.id;
    }
  }
  return null;
}

function nav(pageId, btn) {
  document.querySelectorAll('.page')
    .forEach(p => p.classList.remove('active'));

  document.querySelectorAll('.sb-item')
    .forEach(b => b.classList.remove('active'));

  const target = document.getElementById('page-' + pageId);
  if (target) target.classList.add('active');

  const sidebarBtn = document.querySelector(
    `.sb-item[onclick*="nav('${pageId}'"]`
  );

  if (sidebarBtn) {
    sidebarBtn.classList.add('active');
  }
}

function formatInitials(name) {
  if (!name) return 'U';
  const parts = name.trim().split(' ');
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function loadCurrentUser() {
  return fetch('/api/auth/me', {
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
      const accountLocationInput = document.getElementById('account-location');
      const accountLocationSelect = document.getElementById('account-location-select');
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

      currentUserLocationName = user.location_name || 'Jakarta Selatan';
      currentUserRegionId = Number(user.location_id) || 1;
      updateUserLocationWidgets();

      if (accountLocationInput) {
        if (typeof populateLocationSelect === 'function') {
          populateLocationSelect('account-location', currentUserLocationName);
        } else {
          accountLocationInput.value = currentUserLocationName;
        }
      } else if (accountLocationSelect) {
        if (typeof populateLocationSelect === 'function') {
          populateLocationSelect('account-location', currentUserLocationName);
        } else {
          accountLocationSelect.value = currentUserLocationName;
        }
      }
      if (accountPersonaSelect) accountPersonaSelect.value = user.persona || 'other';

      loadDashboardStats(currentUserRegionId);
      loadAccountMarketRecommendation();
      applyUserLocationRegionSelection();
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
  const accountLocationInput = document.getElementById('account-location');
  const accountLocationSelect = document.getElementById('account-location-select');
  const accountPersonaSelect = document.getElementById('account-persona-select');

  if (!accountNameInput || !accountEmailInput || !(accountLocationInput || accountLocationSelect) || !accountPersonaSelect) {
    return false;
  }

  const profileData = {
    full_name: accountNameInput.value.trim(),
    email: accountEmailInput.value.trim(),
    location_name: (accountLocationInput ? accountLocationInput.value : accountLocationSelect.value).trim(),
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

  await loadCurrentUser();
  loadAccountMarketRecommendation();
  return true;
}

/* ── 1. DASHBOARD: Memuat Angka Ringkasan Statistik ──────────────── */
function loadDashboardStats(regionId = currentUserRegionId) {
  const regionQuery = regionId ? `?region_id=${encodeURIComponent(regionId)}` : '';
  fetch(`/api/commodity${regionQuery}`, {
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
    })
    .catch(err => console.error("Gagal memuat statistik harga beras:", err));

  fetch('/api/pantry', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    .then(res => res.ok ? res.json() : { data: [] })
    .then(result => {
      const totalPantryEl = document.getElementById('dash-total-pantry');
      if (totalPantryEl) {
        totalPantryEl.innerHTML = `${result.data.length}<span class="stat-unit"> item</span>`;
      }
    })
    .catch(err => console.error("Gagal memuat jumlah pantry:", err));
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

  const charts = priceTrendCache.filter(item => item.commodity_name === selected).map(item => {
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

    const bars = history.map((record, index) => {
      const height = maxPrice === minPrice ? 50 : ((record.price_value - minPrice) / (maxPrice - minPrice)) * 80 + 10;
      const label = formatTrendDate(record.recorded_date);
      return `<div class="lc-bar" title="${label}: Rp ${Number(record.price_value).toLocaleString('id-ID')}" style="height:${height}%"></div>`;
    }).join('');

    const labels = history.map((record, index) => {
      const offsetFromToday = history.length - 1 - index;
      const labelText = offsetFromToday === 0 ? 'Hari ini' : `H-${offsetFromToday}`;
      return `<span class="lc-lbl">${labelText}</span>`;
    }).join('');
    const trendColor = item.trend === 'up' ? 'var(--red)' : item.trend === 'down' ? 'var(--g2)' : 'var(--text3)';
    const trendBadge = item.trend === 'up' ? 'pill-buy' : item.trend === 'down' ? 'pill-wait' : 'pill-watch';
    const changeText = item.percentage !== 0 ? `${item.percentage > 0 ? '+' : ''}${item.percentage.toFixed(1)}%` : '0.0%';

    return `
      <div class="trend-area trend-chart-card">
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
        const currentPrice = latest?.price_value ?? 0;
        
        // Calculate average price
        const avgPrice = sortedRecords.length > 0 
          ? sortedRecords.reduce((sum, r) => sum + Number(r.price_value), 0) / sortedRecords.length 
          : 0;

        // Determine trend and percentage based on current price vs average
        let percentage = 0;
        let trend = 'steady';
        let trendLabel = 'Stabil';

        if (avgPrice !== 0) {
          percentage = ((currentPrice - avgPrice) / avgPrice) * 100;
          trend = percentage > 1 ? 'up' : percentage < -1 ? 'down' : 'steady';
          trendLabel = trend === 'up' ? 'Naik' : trend === 'down' ? 'Turun' : 'Stabil';
        }

        return {
          commodity_name,
          currentPrice,
          avgPrice,
          percentage,
          trend,
          trendLabel,
          latestDate: latest?.recorded_date || 'Tidak tersedia',
          source: latest?.source || 'Sumber tidak tersedia',
          records: sortedRecords,
        };
      });

      priceTrendCache = commodityRows;

      // mark loaded for headline rendering
      priceTrendsLoaded = true;
      priceHeadlinesError = false;
      try { renderPriceHeadlines(); } catch(e){}
      try { renderHeadlineProducts(); } catch(e){}

      commodityRows.forEach(item => {
        const trendColor = item.trend === 'up' ? 'var(--red)' : item.trend === 'down' ? 'var(--g2)' : 'var(--text3)';
        const trendBadge = item.trend === 'up' ? 'pill-wait' : item.trend === 'down' ? 'pill-buy' : 'pill-watch';

        const trendHTML = `
          <div class="trend-item">
            <div class="trend-item-header">
              <div class="trend-item-left">
                <strong class="trend-name">${item.commodity_name}</strong>
                <span class="trend-meta">${item.source} • ${item.latestDate}</span>
              </div>
              <span class="pred-pill ${trendBadge}">${item.trendLabel} ${item.percentage !== 0 ? `${item.percentage > 0 ? '+' : ''}${item.percentage.toFixed(1)}%` : '0.0%'}</span>
            </div>
            <div class="trend-item-price">
              <span class="trend-price-current">Rp ${Number(item.currentPrice).toLocaleString('id-ID')}</span>
              <span class="trend-price-avg">rata: Rp ${Number(item.avgPrice).toLocaleString('id-ID')}</span>
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
    .catch(err => {
      console.error("Gagal memuat visualisasi tren harga:", err);
      priceTrendsLoaded = true; // mark as finished to avoid perpetual loading
      priceHeadlinesError = true;
      try { renderPriceHeadlines(); } catch(e){}
    });
}

function renderPriceHeadlines() {

  const container = document.getElementById('price-headline-body');
  const summaryEl = document.getElementById('price-headline-summary');
  const skeletonEl = document.getElementById('price-headline-skeleton');

  if (!container || !summaryEl) return;

  const THRESHOLD = 1;

  // =========================
  // LOADING
  // =========================

  if (!priceTrendsLoaded || !priceForecastLoaded) {

    if (skeletonEl) {
      skeletonEl.style.display = 'block';
    }

    summaryEl.textContent = 'Memuat data...';

    container.innerHTML = `
      <div class="headline-skeleton">
        <div style="
          height:64px;
          border-radius:14px;
          background:#E5E7EB;
          animation:pulse 1.4s infinite;
        "></div>
      </div>
    `;

    return;
  }

  if (skeletonEl) {
    skeletonEl.style.display = 'none';
  }

  // =========================
  // ERROR
  // =========================

  if (priceHeadlinesError) {

    summaryEl.textContent = 'Gagal memuat data';

    container.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        gap:8px;
        color:#92400E;
        font-size:13px;
      ">
        <i class="ti ti-alert-circle"></i>
        <span>
          Gagal memuat data harga. Coba refresh halaman.
        </span>
      </div>
    `;

    return;
  }

  const trends =
    Array.isArray(priceTrendCache)
      ? priceTrendCache
      : [];

  const forecasts =
    Array.isArray(priceForecastCache)
      ? priceForecastCache
      : [];

  // =========================
  // SUMMARY COUNTS
  // =========================

  let naik = 0;
  let turun = 0;
  let stabil = 0;

  trends.forEach(item => {

    const pct =
      Number(item.percentage) || 0;

    if (pct >= THRESHOLD) {
      naik++;
    }
    else if (pct <= -THRESHOLD) {
      turun++;
    }
    else {
      stabil++;
    }

  });

  if (
    naik === 0 &&
    turun === 0 &&
    stabil > 0
  ) {
    summaryEl.textContent =
      'Semua stabil hari ini';
  }
  else if (!trends.length) {
    summaryEl.textContent =
      'Memuat data...';
  }
  else {
    summaryEl.textContent =
      `${naik} naik · ${turun} turun · ${stabil} stabil`;
  }

  // =========================
  // BANNER RULES
  // =========================

  const hasTunda =
    forecasts.some(item =>
      item.trend === 'up' &&
      Math.abs(Number(item.percentage || 0))
        >= THRESHOLD
    );

  const hasBeli =
    trends.some(item =>
      item.trend === 'down' &&
      Math.abs(Number(item.percentage || 0))
        >= THRESHOLD
    );

  const allForecastStable =
    forecasts.length > 0 &&
    forecasts.every(item =>
      Math.abs(
        Number(item.percentage || 0)
      ) < THRESHOLD
    );

  const allTrendStable =
    trends.length > 0 &&
    trends.every(item =>
      Math.abs(
        Number(item.percentage || 0)
      ) < THRESHOLD
    );

  const allStable =
    allForecastStable &&
    allTrendStable;

  // =========================
  // FULLY STABLE
  // =========================

  if (allStable) {

    container.innerHTML = `
      <div
        style="
          display:flex;
          align-items:center;
          gap:16px;
          background:#F8F9FA;
          border:0.5px solid #E5E7EB;
          border-radius:14px;
          padding:16px;
        "
      >

        <div
          style="
            display:flex;
            align-items:center;
            gap:8px;
          "
        >
          <i
            class="ti ti-shield-check"
            style="
              font-size:24px;
              color:#16A34A;
            "
          ></i>

          <span
            style="
              background:#D1FAE5;
              color:#065F46;
              border-radius:999px;
              padding:4px 10px;
              font-size:11px;
              font-weight:600;
            "
          >
            STABIL
          </span>
        </div>

        <div style="flex:1">

          <div
            style="
              font-size:14px;
              font-weight:600;
            "
          >
            Semua harga stabil hari ini —
            tidak ada yang perlu ditunda
            atau diburu
          </div>

          <div
            style="
              margin-top:8px;
              display:flex;
              gap:8px;
              flex-wrap:wrap;
            "
          >

            <span
              style="
                font-size:11px;
                color:#6B7280;
              "
            >
              <i class="ti ti-clock"></i>
              Dipantau sejak pagi ini
            </span>

            <span
              style="
                font-size:11px;
                color:#6B7280;
              "
            >
              <i class="ti ti-refresh"></i>
              Data diperbarui otomatis
            </span>

          </div>

        </div>

      </div>
    `;

    return;
  }

  // =========================
  // TUNDA + BELI
  // =========================

  const banners = [];

  if (hasTunda) {

    banners.push(`
      <div class="headline-card headline-wait">

        <div class="hc-left">
          <i class="ti ti-clock-pause"></i>
        </div>

        <div class="hc-body">
          <div class="hc-title">
            TUNDA
          </div>

          <div class="hc-sub">
            Setidaknya satu komoditas
            diprediksi naik dalam waktu dekat.
          </div>
        </div>

      </div>
    `);

  }

  if (hasBeli) {

    banners.push(`
      <div class="headline-card headline-buy">

        <div class="hc-left">
          <i class="ti ti-shopping-cart-check"></i>
        </div>

        <div class="hc-body">
          <div class="hc-title">
            BELI
          </div>

          <div class="hc-sub">
            Ada komoditas yang sedang turun
            atau berada di area harga rendah.
          </div>
        </div>

      </div>
    `);

  }

  container.innerHTML = `
    <div class="headline-row">
      ${banners.join('')}
    </div>
  `;
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

/* ═══════════════════════════════════════════════════════
   HEADLINE PRODUCTS GRID RENDERING
   ═══════════════════════════════════════════════════════ */

let currentHeadlineFilter = 'increasing';

function renderHeadlineProducts() {
  const grid = document.getElementById('headline-products-grid');
  if (!grid) return;

  if (!priceTrendsLoaded || !priceForecastLoaded) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 40px 20px; text-align: center; color: #6B7280;">
        <div style="font-size: 14px; font-weight: 600;">Memuat produk...</div>
      </div>
    `;
    return;
  }

  // Combine trend and forecast data
  const products = [];
  const THRESHOLD = 1;

  if (Array.isArray(priceForecastCache)) {
    priceForecastCache.forEach(forecast => {
      // Use commodity_name from API response (not name)
      const commodityName = forecast.commodity_name || forecast.name || 'Komoditas';
      const pct = Number(forecast.percentage || 0);
      let trend = 'stable';
      
      if (pct >= THRESHOLD) {
        trend = 'up';
      } else if (pct <= -THRESHOLD) {
        trend = 'down';
      }

      products.push({
        name: commodityName,
        emoji: getProductEmoji(commodityName),
        currentPrice: Number(forecast.current_price || 0),
        predictedPrice: Number(forecast.predicted_price || forecast.current_price || 0),
        percentage: pct,
        unit: forecast.unit || '/kg',
        trend: trend,
        predictedDays: '2-3',  // Default if not available
        type: pct >= THRESHOLD ? 'wait' : (pct <= -THRESHOLD ? 'buy' : 'watch')
      });
    });
  }

  // Update tab counts
  const upDown = products.filter(p => p.trend !== 'stable').length;
  const stable = products.filter(p => p.trend === 'stable').length;
  
  const tabs = document.querySelectorAll('.tab-count');
  if (tabs.length >= 1) tabs[0].textContent = upDown;
  if (tabs.length >= 2) tabs[1].textContent = stable;

  // Filter based on current filter
  let filtered = products;
  if (currentHeadlineFilter === 'increasing') {
    filtered = products.filter(p => p.trend !== 'stable');
  } else if (currentHeadlineFilter === 'stable') {
    filtered = products.filter(p => p.trend === 'stable');
  }

  // Render products
  if (filtered.length === 0) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; padding: 40px 20px; text-align: center; color: #6B7280;">
        <div style="font-size: 14px; font-weight: 600;">Tidak ada data untuk filter ini</div>
      </div>
    `;
    return;
  }

  grid.innerHTML = filtered.map(product => `
    <div class="headline-product-card">
      <div class="hpc-left">
        <div class="hpc-badge">${product.emoji}</div>
      </div>
      

      <div class="hpc-body">
        <div class="hpc-top">
          <div>
            <div class="hpc-name">${product.name}</div>
            <div class="hpc-subtitle">
              Harga ${product.currentPrice < product.predictedPrice ? 'diprediksi naik' : (product.currentPrice > product.predictedPrice ? 'sedang turun' : 'stabil')}
            </div>
          </div>
        </div>

        <div class="hpc-prices">
          <div class="hpc-price-item">
            <div class="hpc-price-label">Saat ini</div>
            <div class="hpc-price-value">Rp${formatRupiah(product.currentPrice)}</div>
          </div>
          <div class="hpc-price-item">
            <div class="hpc-price-label">Prediksi</div>
            <div class="hpc-price-value">Rp${formatRupiah(product.predictedPrice)}</div>
          </div>
        </div>

        <div class="hpc-bottom">
          <div class="hpc-prediction ${product.type}">
            ${product.currentPrice < product.predictedPrice ? '↑' : '↓'} ${Math.abs(product.percentage).toFixed(1)}%
          </div>
          <div style="font-size: 11px; color: #6B7280;">
            dalam ${product.predictedDays} hari
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

function getProductEmoji(name) {
  if (!name) return '📦';
  const normalized = String(name).toLowerCase();
  if (normalized.includes('cabai') || normalized.includes('chili')) return '🌶️';
  if (normalized.includes('bawang') || normalized.includes('garlic')) return '🧄';
  if (normalized.includes('tomat') || normalized.includes('tomato')) return '🍅';
  if (normalized.includes('beras') || normalized.includes('rice')) return '🌾';
  if (normalized.includes('telur') || normalized.includes('egg')) return '🥚';
  if (normalized.includes('daging') || normalized.includes('beef') || normalized.includes('meat')) return '🥩';
  if (normalized.includes('minyak') || normalized.includes('oil')) return '🧈';
  if (normalized.includes('gula') || normalized.includes('sugar')) return '🍯';
  return '📦';
}

function filterHeadlines(type) {
  currentHeadlineFilter = type;
  
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('.tab-btn').classList.add('active');
  
  // Re-render products
  renderHeadlineProducts();
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
    recommendation: trend === 'up' ? 'Tunda pembelian' : trend === 'down' ? 'Beli sekarang' : 'Pantau harga',
    sourceLabel: 'Trend lokal',
    isAi: false,
    series: buildDailySeries(latestPrice, predictedPrice),
  };
}

function buildForecastSummaryCardMarkup(item) {
  const trendColor = item.trend === 'down' ? 'var(--g2)' : item.trend === 'up' ? 'var(--red)' : 'var(--text3)';
  const trendLabel = item.trend === 'down' ? 'Turun' : item.trend === 'up' ? 'Naik' : 'Stabil';
  const trendBadge = item.trend === 'up' ? 'pill-wait' : item.trend === 'down' ? 'pill-buy' : 'pill-watch';
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
  const trendBadge = item.trend === 'up' ? 'pill-wait' : item.trend === 'down' ? 'pill-buy' : 'pill-watch';
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

/* ── 3. DIGITAL KITCHEN: Sinkronisasi Grid Card Sesuai CSS Figma ── */
function loadPantryItems() {
  fetch('/api/pantry', {
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    })
    .then(res => res.ok ? res.json() : { data: [] })
    .then(result => {
      const data = result.data || [];
      const container = document.getElementById('pantry-items-container');
      const detailPanel = document.getElementById('pantry-item-detail');
      if (!container) return;

      container.innerHTML = '';
      if (detailPanel) {
        detailPanel.style.display = 'none';
      }

      if (data.length === 0) {
          try {
            updatePantryNotifications([]);
          } catch (err) {
            console.warn('Gagal memperbarui notifikasi pantry:', err);
          }

          container.innerHTML =
            '<p style="padding: 20px; color: var(--text3); grid-column: 1/-1;">Dapur kosong. Masukkan bahan baru untuk mulai memantau stok.</p>';

          return;
      }

      data.forEach(item => {
        const statusClass = item.status === 'expired' ? 'tag-red' : item.status === 'expires-today' ? 'tag-red' : item.status === 'soon' ? 'tag-amber' : item.status === 'warning' ? 'tag-amber' : 'tag-green';
        const statusLabel = item.status_text || 'Status tidak tersedia';
        const itemHTML = `
          <div class="pantry-card pantry-card-clickable" data-item-id="${item.item_id}">
            <div class="p-head" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
              <div style="flex:1">
                <span class="p-title">${item.commodity}</span>
                <div style="font-size:12px;color:var(--text3)">${item.quantity} ${item.unit}</div>
              </div>
              <div style="display:flex;gap:8px;align-items:center">
                <button class="btn btn-out btn-sm pantry-delete-btn" data-item-id="${item.item_id}" title="Hapus">Hapus</button>
              </div>
            </div>
            <div class="p-body">
              <div class="p-info">Beli: <strong>${item.purchase_date}</strong></div>
              <div class="p-info">Harga beli: <strong>${item.purchase_price ? ('Rp ' + Number(item.purchase_price).toLocaleString('id-ID')) : '-'}</strong></div>
              <div class="p-info">Kadaluarsa: <strong>${item.expiry_date || '-'}</strong></div>
            </div>
            <div class="p-info" style="margin-top: 10px; display:flex; justify-content:space-between; align-items:center;">
              <span class="tag ${statusClass}" style="padding: 4px 8px; font-size:12px;">${statusLabel}</span>
            </div>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', itemHTML);
      });

      container.querySelectorAll('.pantry-card-clickable').forEach(card => {
            card.addEventListener('click', () => {
              const itemId = card.getAttribute('data-item-id');
              const item = data.find(i => String(i.item_id) === String(itemId));
              if (item) {
                showPantryItemDetails(item);
              }
            });
      });
      container.querySelectorAll('.pantry-delete-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          const id = btn.getAttribute('data-item-id');
          if (!id) return;
          if (!confirm('Hapus bahan ini dari daftar? Tindakan ini tidak dapat dibatalkan.')) return;
          deletePantryItem(id);
        });
      });
      // Perbarui notifikasi/indikator dan tabel stok berdasarkan data pantry yang baru dimuat
      try {
        updatePantryNotifications(data);
      } catch (err) {
        console.warn('Gagal memperbarui notifikasi pantry:', err);
      }
      try {
        updateStockTable(data);
      } catch (err) {
        console.warn('Gagal memperbarui tabel stok pantry:', err);
      }
    })
    .catch(err => console.error("Gagal memuat list dapur:", err));
}

function updatePantryNotifications(items) {
  const data = items || [];

  const pantryToast = document.querySelector('.toast.red');
  const notifDot = document.querySelector('.notif-dot');

  // Pantry kosong -> sembunyikan semua notifikasi
  if (data.length === 0) {
    if (pantryToast) {
      pantryToast.style.display = 'none';
    }

    if (notifDot) {
      notifDot.style.display = 'none';
      notifDot.textContent = '';
    }

    return;
  }

  // Cari item yang perlu perhatian (<= 3 hari atau sudah expired)
  const attentionItems = data.filter(i => {
    if (i.days_remaining != null) {
      return Number(i.days_remaining) <= 3;
    }

    if (i.expiry_date) {
      const d = new Date(i.expiry_date);
      const now = new Date();
      const diff = Math.ceil(
        (d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) /
        (1000 * 60 * 60 * 24)
      );

      return diff <= 3;
    }

    return false;
  });

  const attentionCount = attentionItems.length;

  // Semua bahan aman -> sembunyikan toast & notif
  if (attentionCount === 0) {
    if (pantryToast) {
      pantryToast.style.display = 'none';
    }

    if (notifDot) {
      notifDot.style.display = 'none';
      notifDot.textContent = '';
    }

    return;
  }

  // Ada peringatan -> tampilkan toast
  if (pantryToast) {
    pantryToast.style.display = 'flex';
  }

  // Judul notifikasi
  const pantryToastTitle = document.querySelector('.toast.red .toast-title');
  if (pantryToastTitle) {
    pantryToastTitle.textContent =
      `${attentionCount} bahan perlu perhatian segera!`;
  }

  // Detail item yang perlu perhatian
  const pantryToastSub = document.querySelector('.toast.red .toast-sub');
  if (pantryToastSub) {
    const alertItems = attentionItems
      .slice()
      .sort((a, b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999))
      .slice(0, 3);

    pantryToastSub.textContent = alertItems
      .map(i => `${i.commodity} ${String(i.status_text).toLowerCase()}`)
      .join(', ');
  }

  // Badge notifikasi di topbar
  if (notifDot) {
    notifDot.style.display = 'block';
    notifDot.textContent = attentionCount > 9 ? '9+' : String(attentionCount);
    notifDot.title = `${attentionCount} notifikasi peringatan kadaluarsa`;

    notifDot.style.minWidth = '18px';
    notifDot.style.height = '18px';
    notifDot.style.padding = '0 5px';
    notifDot.style.borderRadius = '9px';
    notifDot.style.fontSize = '12px';
    notifDot.style.lineHeight = '18px';
    notifDot.style.textAlign = 'center';
  }
}

async function deletePantryItem(itemId) {
  try {
    const res = await fetch(`/api/pantry/${itemId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
    });

    // try parse json, otherwise get text for debugging
    let result = {};
    try { result = await res.json(); } catch(e) { result = { __raw: await res.text() }; }

    if (!res.ok) {
      const serverMsg = result.error || result.message || result.__raw || `HTTP ${res.status}`;
      console.error('DELETE /api/pantry response:', res.status, result);
      throw new Error(serverMsg || 'Gagal menghapus item');
    }
    alert('Item berhasil dihapus');
    loadDashboardStats();
    loadPantryItems();
    loadPriceTrends();
    window.location.reload();
  } catch (err) {
    console.error('deletePantryItem error:', err);
    alert('Gagal menghapus item: ' + (err.message || err));
  }
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
          recommendation: payload.recommendation || (trend === 'up' ? 'Tunda pembelian' : trend === 'down' ? 'Beli sekarang' : 'Pantau harga'),
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

    // Cache forecasts for headline rendering
    priceForecastCache = sortedForecasts;
    priceForecastLoaded = true;
    priceHeadlinesError = false;
    try { renderPriceHeadlines(); } catch(e){}
    try { renderHeadlineProducts(); } catch(e){}

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
    priceForecastLoaded = true;
    priceHeadlinesError = true;
    try { renderPriceHeadlines(); } catch(e){}
    try { renderHeadlineProducts(); } catch(e){}
  }
}

function loadAccountMarketRecommendation() {
  const accountMarketBody = document.getElementById('account-market-recommendation');
  if (!accountMarketBody) return;

  const regionId = currentUserRegionId || 1;
  accountMarketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Memuat rekomendasi pasar untuk lokasi akun...</p>';

  fetch(`/api/predictor/compare?commodity=Chili%20(Red)&region_id=${encodeURIComponent(regionId)}`)
    .then(res => res.ok ? res.json() : Promise.reject('Tidak dapat mengambil rekomendasi pasar'))
    .then(result => {
      const data = result.data || {};
      const items = data.recommendations || [];
      if (!items.length) {
        accountMarketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Rekomendasi pasar tidak tersedia untuk lokasi akun.</p>';
        return;
      }

      let html = '<div style="display:grid;gap:12px">';
      items.slice(0, 4).forEach(item => {
        const price = item.predicted_price ? Number(item.predicted_price).toLocaleString('id-ID') : '--';
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border-radius:14px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${item.market}</div>
              <div style="font-size:12px;color:var(--text3);">Jarak ~${item.distance || '-'} km</div>
            </div>
            <div style="font-size:14px;font-weight:700;color:var(--g2)">Rp ${price}</div>
          </div>`;
      });
      html += '</div>';
      html += `<div style="margin-top:14px;font-size:13px;color:var(--text3)">${data.recommendation || 'Rekomendasi dihitung oleh model AI.'}</div>`;
      accountMarketBody.innerHTML = html;
    })
    .catch(err => {
      console.error('Gagal memuat rekomendasi pasar akun:', err);
      accountMarketBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Rekomendasi pasar tidak tersedia.</p>';
    });
}

function applyUserLocationRegionSelection() {
  const sel = document.getElementById('market-region-select');
  if (!sel || !marketRegionsList.length) return;
  const preferredId = findRegionIdByLocationName(currentUserLocationName, marketRegionsList) || currentUserRegionId || marketRegionsList[0]?.id || 1;
  if (preferredId) {
    sel.value = preferredId;
    loadMarketComparison();
  }
}

function loadMarketComparison() {
  const sel = document.getElementById('market-region-select');
  const regionId = sel && sel.value ? sel.value : currentUserRegionId || '1';
  fetch(`/api/predictor/compare?commodity=Chili%20(Red)&region_id=${encodeURIComponent(regionId)}`)
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
        html += `
          <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;padding:12px;background:rgba(255,255,255,0.04);border-radius:14px">
            <div>
              <div style="font-size:14px;font-weight:700;color:var(--text)">${item.market}</div>
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

function loadMarketRegions() {
  fetch('/api/predictor/regions')
    .then(res => res.ok ? res.json() : Promise.reject('Gagal memuat wilayah'))
    .then(result => {
      const regions = result.data || [];
      const sel = document.getElementById('market-region-select');
      if (!sel) return;

      marketRegionsList = regions;
      const prev = sel.value;
      sel.innerHTML = regions.map(r => `<option value="${r.id}">${r.name}</option>`).join('');
      const preferredId = findRegionIdByLocationName(currentUserLocationName, regions) || currentUserRegionId || regions[0]?.id || 1;
      if (preferredId) {
        sel.value = preferredId;
      } else if (prev) {
        const found = Array.from(sel.options).some(opt => opt.value === prev);
        if (found) sel.value = prev;
      }

      sel.onchange = () => loadMarketComparison();
      const btn = document.getElementById('market-region-refresh');
      if (btn) btn.onclick = () => loadMarketRegions();

      loadMarketComparison();
    })
    .catch(err => {
      console.error('Gagal memuat daftar wilayah:', err);
    });
}

/* ── 4. FORM HANDLING: Tangkap Event POST ────────────────────────── */
function handlePantryForm() {
  const form = document.getElementById('form-add-commodity');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();

    const name = document.getElementById('input-comm-name').value.trim();
    const quantity = document.getElementById('input-comm-quantity').value;
    const unit = document.getElementById('input-comm-unit').value.trim();
    const purchaseDate = document.getElementById('input-purchase-date').value;
    const expiryDate = document.getElementById('input-expiry-date').value;
    const rawPrice = document.getElementById('input-purchase-price').value || '';
    // sanitize price: allow users to type with or without separators and optional 'Rp'
    const digitsOnly = rawPrice.replace(/[^0-9]/g, '');
    const purchasePrice = digitsOnly ? parseFloat(digitsOnly) : null;

    const payload = {
      commodity_name: name,
      quantity: parseFloat(quantity),
      unit: unit || 'pcs',
      purchase_date: purchaseDate,
      expiry_date: expiryDate || null,
      purchase_price: purchasePrice != null ? purchasePrice : null,
    };

    fetch('/api/pantry', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...getAuthHeaders(),
      },
      body: JSON.stringify(payload)
    })
    .then(async res => {
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || 'Gagal menyimpan ke pantry.');
      return result;
    })
    .then(result => {
      alert("Sukses! Bahan dapur berhasil ditambahkan.");
      form.reset();
      loadDashboardStats();
      loadPantryItems();
    })
    .catch(err => alert("Gagal memproses penyimpanan data: " + err.message));
  });
}

function showPantryItemDetails(item) {
  const detailPanel = document.getElementById('pantry-item-detail');
  const detailContent = document.getElementById('pantry-item-detail-content');
  if (!detailPanel || !detailContent) return;

  const expiryText = item.expiry_date || 'Belum diisi';
  const priceText = item.purchase_price ? `Rp ${Number(item.purchase_price).toLocaleString('id-ID')}` : 'Tidak tersedia';
  const statusClass = item.status === 'expired' || item.status === 'expires-today' ? 'tag-red' : item.status === 'soon' || item.status === 'warning' ? 'tag-amber' : 'tag-green';

  detailContent.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
      <div>
        <div style="font-size:18px;font-weight:700;color:var(--text)">${item.commodity}</div>
        <div style="font-size:13px;color:var(--text3)">Jumlah: ${item.quantity} ${item.unit}</div>
      </div>
      <span class="tag ${statusClass}">${item.status_text}</span>
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
      <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:14px">
        <div style="font-size:12px;color:var(--text4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Dibeli pada</div>
        <div style="font-size:14px;font-weight:700">${item.purchase_date}</div>
      </div>
      <div style="background:rgba(255,255,255,0.04);padding:12px;border-radius:14px">
        <div style="font-size:12px;color:var(--text4);text-transform:uppercase;letter-spacing:.08em;margin-bottom:6px">Kadaluarsa</div>
        <div style="font-size:14px;font-weight:700">${expiryText}</div>
      </div>
    </div>
    <div style="margin-top:14px;padding:12px;background:rgba(255,255,255,0.04);border-radius:14px">
      <div style="font-size:12px;color:var(--text4);margin-bottom:6px">Harga beli</div>
      <div style="font-size:14px;font-weight:700">${priceText}</div>
    </div>
  `;
  detailPanel.style.display = 'block';
}

function hidePantryItemDetails() {
  const detailPanel = document.getElementById('pantry-item-detail');
  const detailContent = document.getElementById('pantry-item-detail-content');
  if (!detailPanel) return;
  detailPanel.style.display = 'none';
  if (detailContent) detailContent.innerHTML = '';
}

function handleImportExcel() {
  const button = document.getElementById('btn-import-excel');
  if (!button) return;

  button.addEventListener('click', async () => {
    button.disabled = true;
    const originalText = button.textContent;
    button.textContent = 'Mengimpor data...';

    try {
      const response = await fetch('/api/commodity/import-excel', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
        },
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Import Excel gagal');
      }

      alert(`Sukses mengimpor ${result.imported} baris data komoditas dari Excel.`);
      loadDashboardStats();
      loadPriceTrends();
      loadPantryItems();
    } catch (err) {
      alert('Gagal mengimpor data Excel: ' + err.message);
    } finally {
      button.disabled = false;
      button.textContent = originalText;
    }
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


function initAddKitchen() {
  document.querySelectorAll('.add-kitchen-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      nav('pantry', btn);
    });
  });

  // Close button for pantry detail
  const closeBtn = document.getElementById('pantry-item-detail-close');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      hidePantryItemDetails();
    });
  }
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

// Render/update tabel Stok Bahan Dapur dari data pantry
function updateStockTable(items) {
  const data = items || [];
  const tbody = document.getElementById('stock-table-body');
  if (!tbody) return;

  // Default sample items (preserved UI content) if backend has no data
  const defaultSamples = [
    { commodity: 'Beras', quantity: 5, unit: 'kg', expiry_date: addDaysISO(120), status: 'ok', status_text: 'Aman', stock_pct: 65 },
    { commodity: 'Telur', quantity: 10, unit: 'butir', expiry_date: addDaysISO(5), status: 'warning', status_text: 'Perhatian', stock_pct: 35 },
    { commodity: 'Mentega', quantity: 0.2, unit: 'kg', expiry_date: addDaysISO(0), status: 'expired', status_text: 'Kritis', stock_pct: 15 },
    { commodity: 'Susu', quantity: 1, unit: 'L', expiry_date: addDaysISO(7), status: 'ok', status_text: 'Aman', stock_pct: 70 },
    { commodity: 'Roti Tawar', quantity: 1, unit: 'pak', expiry_date: addDaysISO(2), status: 'warning', status_text: 'Perhatian', stock_pct: 25 },
  ];

  const source = data.length === 0 ? defaultSamples : data;

  const rows = source.map(item => {
    const name = item.commodity || '—';
    const qty = item.quantity != null ? `${item.quantity} ${item.unit || ''}`.trim() : '-';

    // determine percentage: prefer explicit stock_pct, otherwise estimate from quantity
    let pct = null;
    if (item.stock_pct != null) pct = Math.max(0, Math.min(100, Number(item.stock_pct)));
    else if (item.quantity != null) {
      const q = Number(item.quantity);
      if (!isNaN(q)) {
        if (q <= 1) pct = 10;
        else if (q <= 2) pct = 25;
        else if (q <= 5) pct = 50;
        else if (q <= 10) pct = 75;
        else pct = 90;
      }
    }

    // Expiry / days left
    let expiryLabel = '-';
    if (item.expiry_date) {
      const d = new Date(item.expiry_date);
      const now = new Date();
      const diff = Math.ceil((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (1000*60*60*24));
      if (isNaN(diff)) expiryLabel = item.expiry_date;
      else if (diff <= 0) expiryLabel = '⛔ Hari ini!';
      else expiryLabel = `${diff} hari lagi`;
    }

    // status badge
    const statusClass = item.status === 'expired' || item.status === 'expires-today' ? 'tag-red' : item.status === 'soon' || item.status === 'warning' ? 'tag-amber' : 'tag-green';
    const statusText = item.status_text || (item.status === 'expired' ? 'Kritis' : 'Aman');

    const barWidth = pct != null ? `${pct}%` : '0%';
    const pctLabel = pct != null ? `${pct}%` : '';

    return `
      <tr>
        <td>${escapeHtml(name)}</td>
        <td>${escapeHtml(qty)}</td>
        <td>${item.purchase_price != null ? ('Rp ' + Number(item.purchase_price).toLocaleString('id-ID')) : '-'}</td>
        <td style="${expiryLabel.includes('Hari ini') ? 'color:var(--red);font-weight:700' : ''}">${escapeHtml(expiryLabel)}</td>
        <td><span class="tag ${statusClass}">${escapeHtml(statusText)}</span></td>
      </tr>
    `;
  }).join('');

  tbody.innerHTML = rows;
}

function escapeHtml(text) {
  if (text == null) return '';
  return String(text).replace(/[&<>"']/g, function (s) {
    return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":"&#39;"})[s];
  });
}

// Map commodity name to a relevant emoji using keyword matching
// commodityToEmoji removed — no emoji in stock table per UX request

function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}