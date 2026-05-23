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

  if (!accountNameInput || !accountEmailInput || !accountLocationInput) {
    return false;
  }

  const profileData = {
    full_name: accountNameInput.value.trim(),
    email: accountEmailInput.value.trim(),
    location_name: accountLocationInput.value.trim(),
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

/* ── 2. PRICE TRENDS: Sinkronisasi Grafik Batang Sesuai CSS Figma ── */
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
      if (!container) return;

      container.innerHTML = ''; 

      if (data.length === 0) {
        container.innerHTML = '<p style="padding: 16px; color: var(--text3);">Belum ada data tren harga di SQLite. Silakan isi form di tab Digital Kitchen.</p>';
        return;
      }

      data.forEach(item => {
        // Skala bar berdasarkan proporsi harga (asumsi max harga 100rb)
        const barWidth = Math.min((item.price_value / 100000) * 100, 100);
        
        // Menggunakan murni class .trend-item, .trend-name, .trend-graph, dan .tg-bar dari style.css asli kamu
        const trendHTML = `
          <div class="trend-item">
            <div class="trend-name">
              <strong>${item.commodity_name}</strong>
              <span class="trend-meta">${item.source} • ${item.recorded_date}</span>
            </div>
            <div class="trend-graph">
              <div class="tg-bar" style="width: ${barWidth}%;"></div>
            </div>
            <div class="trend-val">
              <span class="t-current">Rp ${Number(item.price_value).toLocaleString('id-ID')}</span>
            </div>
          </div>
        `;
        container.insertAdjacentHTML('beforeend', trendHTML);
      });
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

function loadPriceForecast() {
  fetch('/api/predictor/forecast')
    .then(res => res.ok ? res.json() : Promise.reject('Tidak dapat mengambil prediksi'))
    .then(result => {
      const data = result.data || {};
      const forecastBody = document.getElementById('predictor-forecast-body');
      if (forecastBody) {
        const trendColor = data.trend === 'down' ? 'var(--g2)' : data.trend === 'up' ? 'var(--red)' : 'var(--text3)';
        const trendLabel = data.trend === 'down' ? 'Turun' : data.trend === 'up' ? 'Naik' : 'Stabil';
        forecastBody.innerHTML = `
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;align-items:center">
            <div>
              <div style="font-size:18px;font-weight:700;color:${trendColor}">${trendLabel} ${data.percentage ?? '--'}%</div>
              <div style="margin:10px 0 0;color:var(--text3)">Prediksi harga oleh backend AI</div>
              <div style="margin-top:14px;font-size:14px;line-height:1.5">
                Saat ini: <strong>Rp ${data.current_price ? Number(data.current_price).toLocaleString('id-ID') : '--'}</strong><br/>
                Prediksi: <strong>Rp ${data.predicted_price ? Number(data.predicted_price).toLocaleString('id-ID') : '--'}</strong>
              </div>
            </div>
            <div style="padding:16px;background:var(--bdr);border-radius:14px;text-align:center">
              <div style="font-size:12px;color:var(--text4);text-transform:uppercase;letter-spacing:.07em;margin-bottom:8px">Rekomendasi</div>
              <div style="font-size:16px;font-weight:700;line-height:1.4;color:var(--text)">${data.recommendation || 'Tidak tersedia'}</div>
            </div>
          </div>
        `;
      }

      const tableBody = document.getElementById('predictor-table-body');
      if (tableBody) {
        const changeSign = data.trend === 'down' ? '-' : data.trend === 'up' ? '+' : '';
        const changeColor = data.trend === 'down' ? 'var(--g2)' : data.trend === 'up' ? 'var(--red)' : 'var(--text3)';
        tableBody.innerHTML = `
          <tr>
            <td>Komoditas Utama</td>
            <td>Rp ${data.current_price ? Number(data.current_price).toLocaleString('id-ID') : '--'}/kg</td>
            <td>Rp ${data.predicted_price ? Number(data.predicted_price).toLocaleString('id-ID') : '--'}</td>
            <td style="color:${changeColor};font-weight:600">${changeSign}${data.percentage ?? '--'}%</td>
            <td><span class="pred-pill ${data.trend === 'down' ? 'pill-wait' : data.trend === 'up' ? 'pill-buy' : 'pill-watch'}">${data.recommendation || 'Tunggu'}</span></td>
          </tr>
        `;
      }
    })
    .catch(err => {
      console.error('Gagal memuat prediksi harga:', err);
      const tableBody = document.getElementById('predictor-table-body');
      if (tableBody) {
        tableBody.innerHTML = '<tr><td colspan="5" style="padding:16px;color:var(--text3);text-align:center">Prediksi gagal dimuat.</td></tr>';
      }
      const forecastBody = document.getElementById('predictor-forecast-body');
      if (forecastBody) {
        forecastBody.innerHTML = '<p style="padding:16px;color:var(--text3);margin:0">Prediksi tidak tersedia saat ini.</p>';
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