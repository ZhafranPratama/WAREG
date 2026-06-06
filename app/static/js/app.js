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
  handleImportExcel();
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
        container.innerHTML = '<p style="padding: 20px; color: var(--text3); grid-column: 1/-1;">Dapur kosong. Masukkan bahan baru untuk mulai memantau stok.</p>';
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
      // Attach delete handlers (stop propagation so it doesn't open detail)
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

// Update UI notifikasi berdasarkan kondisi pantry
function updatePantryNotifications(items) {
  const data = items || [];
  // Attention only for items expiring within 3 days (including today and already expired)
  const attentionItems = data.filter(i => {
    if (i.days_remaining != null) return Number(i.days_remaining) <= 3;
    if (i.expiry_date) {
      const d = new Date(i.expiry_date);
      const now = new Date();
      const diff = Math.ceil((d - new Date(now.getFullYear(), now.getMonth(), now.getDate())) / (1000*60*60*24));
      return diff <= 3;
    }
    return false;
  });
  const attentionCount = attentionItems.length;

  // Update toast di halaman pantry
  const pantryToastTitle = document.querySelector('#page-pantry .toast.red .toast-title');
  if (pantryToastTitle) {
    pantryToastTitle.textContent = attentionCount > 0 ? `${attentionCount} bahan perlu perhatian segera!` : 'Semua bahan aman';
  }

  // Update subtext (list contoh item yang perlu perhatian)
  const pantryToastSub = document.querySelector('#page-pantry .toast.red .toast-sub');
    if (pantryToastSub) {
    if (attentionCount > 0) {
      const alertItems = attentionItems
        .slice() // copy
        .sort((a,b) => (a.days_remaining ?? 999) - (b.days_remaining ?? 999))
        .slice(0,3);
      const subText = alertItems.map(i => `${i.commodity} ${String(i.status_text).toLowerCase()}`).join(', ');
      pantryToastSub.textContent = subText || '';
    } else {
      pantryToastSub.textContent = '';
    }
  }

  // Update dot notifikasi di topbar (tampilkan jumlah)
  const notifDot = document.querySelector('.notif-dot');
  if (notifDot) {
    if (attentionCount > 0) {
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
    } else {
      notifDot.style.display = 'none';
      notifDot.textContent = '';
    }
  }
}

// Delete pantry item by id
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
  } catch (err) {
    console.error('deletePantryItem error:', err);
    alert('Gagal menghapus item: ' + (err.message || err));
  }
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
        <td>
          <div style="display:flex;align-items:center;gap:8px">
            <div style="width:80px;height:5px;background:var(--bdr);border-radius:3px;overflow:hidden">
              <div style="width:${barWidth};height:100%;background:${pct != null ? (pct <= 20 ? 'var(--red)' : pct <= 50 ? '#F59E0B' : 'var(--g3)') : 'var(--g3)'};border-radius:3px"></div>
            </div>
            <span style="font-size:11px;color:${pct != null ? (pct <= 20 ? 'var(--red)' : pct <= 50 ? 'var(--amb)' : 'var(--g2)') : 'var(--text3)'};font-weight:600">${escapeHtml(pctLabel)}</span>
          </div>
        </td>
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