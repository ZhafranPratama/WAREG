window.INDONESIAN_LOCATIONS = [
  "Jakarta Pusat",
  "Jakarta Utara",
  "Jakarta Barat",
  "Jakarta Selatan",
  "Jakarta Timur",
  "Kepulauan Seribu",
  "Bandung",
  "Bogor",
  "Depok",
  "Bekasi",
  "Cimahi",
  "Cirebon",
  "Sukabumi",
  "Tasikmalaya",
  "Banjar",
  "Garut",
  "Sumedang",
  "Majalengka",
  "Subang",
  "Kuningan",
  "Indramayu",
  "Karawang",
  "Purwakarta",
  "Cianjur",
  "Pangandaran",
  "Serang",
  "Tangerang",
  "South Tangerang",
  "Cilegon",
  "Bandar Lampung",
  "Metro",
  "Palembang",
  "Lubuklinggau",
  "Pagar Alam",
  "Prabumulih",
  "Pringsewu",
  "Bengkulu",
  "Curup",
  "Jambi",
  "Sungai Penuh",
  "Padang",
  "Bukittinggi",
  "Payakumbuh",
  "Sawahlunto",
  "Pariaman",
  "Solok",
  "Padang Panjang",
  "Pekanbaru",
  "Dumai",
  "Banda Aceh",
  "Langsa",
  "Lhokseumawe",
  "Sabang",
  "Medan",
  "Pematangsiantar",
  "Binjai",
  "Tebing Tinggi",
  "Tanjung Balai",
  "Sibolga",
  "Padang Sidempuan",
  "Gunungsitoli",
  "Mandailing Natal",
  "Pontianak",
  "Singkawang",
  "Samarinda",
  "Balikpapan",
  "Bontang",
  "Tarakan",
  "Palangka Raya",
  "Banjarbaru",
  "Banjarmasin",
  "Martapura",
  "Makassar",
  "Parepare",
  "Palopo",
  "Palu",
  "Manado",
  "Bitung",
  "Tomohon",
  "Kotamobagu",
  "Gorontalo",
  "Kendari",
  "Bau-Bau",
  "Mamuju",
  "Donggala",
  "Luwuk",
  "Ternate",
  "Tidore",
  "Ambon",
  "Tual",
  "Saparua",
  "Namlea",
  "Jayapura",
  "Merauke",
  "Nabire",
  "Timika",
  "Sorong",
  "Manokwari",
  "Fakfak",
  "Wamena",
  "Denpasar",
  "Singaraja",
  "Gianyar",
  "Tabanan",
  "Badung",
  "Klungkung",
  "Karangasem",
  "Bangli",
  "Mataram",
  "Praya",
  "Bima",
  "Sumbawa Besar",
  "Dompu",
  "Kupang",
  "Maumere",
  "Waingapu",
  "Ende",
  "Larantuka",
  "Soe",
  "Semarang",
  "Surakarta",
  "Yogyakarta",
  "Magelang",
  "Salatiga",
  "Pekalongan",
  "Tegal",
  "Purwokerto",
  "Cilacap",
  "Kudus",
  "Jepara",
  "Demak",
  "Boyolali",
  "Klaten",
  "Rembang",
  "Brebes",
  "Wonogiri",
  "Sragen",
  "Purbalingga",
  "Temanggung",
  "Banjarnegara",
  "Wonosobo",
  "Batang",
  "Kebumen",
  "Grobogan",
  "Surabaya",
  "Sidoarjo",
  "Malang",
  "Kediri",
  "Blitar",
  "Madiun",
  "Jember",
  "Banyuwangi",
  "Probolinggo",
  "Pasuruan",
  "Mojokerto",
  "Batu",
  "Gresik",
  "Lamongan",
  "Bojonegoro",
  "Tuban",
  "Sumenep",
  "Bangkalan",
  "Sampang",
  "Pamekasan",
  "Tanjung Pinang",
  "Batam",
  "Pangkal Pinang"
];

function populateLocationSelect(baseId, selectedValue) {
  const input = document.getElementById(baseId);
  const optionsContainer = document.getElementById(`${baseId}-options`);
  const el = document.getElementById(baseId);
  if (!el) return;

  const locations = window.INDONESIAN_LOCATIONS || [];

  // If target is a <select>, render as select with optional search input
  if (el.tagName.toLowerCase() === 'select') {
    const select = el;
    const searchInput = document.getElementById(`${baseId}-search`);

    const renderOptions = (query = '') => {
      const normalizedQuery = String(query || '').toLowerCase().trim();
      select.innerHTML = '<option value="" disabled selected>Pilih lokasi</option>';

      locations
        .filter((location) => location.toLowerCase().includes(normalizedQuery))
        .forEach((location) => {
          const option = document.createElement('option');
          option.value = location;
          option.textContent = location;
          select.appendChild(option);
        });

      if (selectedValue) {
        try { select.value = selectedValue; } catch (e) {}
        if (!select.value && select.options.length > 1) {
          select.selectedIndex = 1;
        }
      }

      // update aria-expanded on associated search input (if present)
      if (searchInput) {
        const has = select.options && select.options.length > 1;
        searchInput.setAttribute('aria-expanded', has ? 'true' : 'false');
      }
    };

    renderOptions(searchInput ? searchInput.value : '');

    if (searchInput && !searchInput.dataset.locationSearchInit) {
      searchInput.dataset.locationSearchInit = 'true';
      searchInput.addEventListener('input', () => renderOptions(searchInput.value));
    }
    return;
  }

  // If target is an <input>, treat as autocomplete (used on register page)
  if (el.tagName.toLowerCase() === 'input') {
    const input = el;
    const optionsContainer = document.getElementById(`${baseId}-options`);
    if (!optionsContainer) return;

    let activeIndex = -1;
    const updateActive = () => {
      const items = optionsContainer.querySelectorAll('.autocomplete-option');
      items.forEach((it, idx) => {
        if (idx === activeIndex) {
          it.classList.add('active');
          it.setAttribute('aria-selected', 'true');
          input.setAttribute('aria-activedescendant', it.id);
          it.scrollIntoView({ block: 'nearest' });
        } else {
          it.classList.remove('active');
          it.setAttribute('aria-selected', 'false');
        }
      });
      if (activeIndex < 0) {
        input.removeAttribute('aria-activedescendant');
      }
    };

    const renderAutocomplete = (query = '') => {
      const q = String(query || '').toLowerCase().trim();
      optionsContainer.innerHTML = '';
      const matched = locations.filter(loc => loc.toLowerCase().includes(q));
      optionsContainer.classList.add('active');

      if (!matched.length) {
        const empty = document.createElement('div');
        empty.className = 'autocomplete-option';
        empty.textContent = 'Tidak ada hasil';
        empty.style.cursor = 'default';
        optionsContainer.appendChild(empty);
        input.setAttribute('aria-expanded', 'false');
        return;
      }

      matched.forEach((loc, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-option';
        item.setAttribute('role', 'option');
        item.id = `${baseId}-option-${idx}`;
        item.setAttribute('aria-selected', 'false');
        item.textContent = loc;
        item.addEventListener('click', () => {
          input.value = loc;
          optionsContainer.innerHTML = '';
          optionsContainer.classList.remove('active');
          input.setAttribute('aria-expanded', 'false');
          input.removeAttribute('aria-activedescendant');
          input.dispatchEvent(new Event('change'));
        });
        optionsContainer.appendChild(item);
      });
      input.setAttribute('aria-expanded', matched.length ? 'true' : 'false');
    };

    // initialize: do not render options immediately — show on input or focus
    if (selectedValue) input.value = selectedValue;

    if (!input.dataset.locationAutocompleteInit) {
      input.dataset.locationAutocompleteInit = 'true';
      input.addEventListener('input', () => {
        activeIndex = -1;
        renderAutocomplete(input.value);
      });
      input.addEventListener('focus', () => {
        activeIndex = -1;
        renderAutocomplete(input.value);
      });
      input.addEventListener('keydown', (e) => {
        const items = optionsContainer.querySelectorAll('.autocomplete-option');
        if (!items.length) return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          activeIndex = Math.min(activeIndex + 1, items.length - 1);
          updateActive();
        } else if (e.key === 'ArrowUp') {
          e.preventDefault();
          activeIndex = Math.max(activeIndex - 1, 0);
          updateActive();
        } else if (e.key === 'Enter') {
          if (activeIndex >= 0 && items[activeIndex]) {
            e.preventDefault();
            items[activeIndex].click();
          }
        } else if (e.key === 'Escape') {
          optionsContainer.innerHTML = '';
          optionsContainer.classList.remove('active');
          input.setAttribute('aria-expanded', 'false');
          activeIndex = -1;
          updateActive();
        }
      });
      // close on outside click
      document.addEventListener('click', (ev) => {
        if (!optionsContainer.contains(ev.target) && ev.target !== input) {
          optionsContainer.innerHTML = '';
          optionsContainer.classList.remove('active');
          input.setAttribute('aria-expanded', 'false');
        }
      });
    }
  }
}
