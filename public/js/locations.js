/**
 * CivicAI - Production-Grade All-India LGD Administrative Location Engine (35 States & UTs)
 * Source: Official Local Government Directory (LGD) Dataset (676,891 Verified Records)
 * Architecture: Lazy-Loaded State Partitioning + Smart Memory Caching
 */

window.statesIndex = [];
window.locationCache = {}; // stateCode -> statePayload
window.selectedLocation = window.selectedLocation || {
  stateName: '',
  stateCode: '',
  districtName: '',
  districtCode: '',
  mandalName: '',
  mandalCode: '',
  villageName: '',
  villageCode: ''
};

/**
 * Path helper with fallbacks for index.json
 */
async function fetchIndexDataset() {
  const possiblePaths = [
    '/data/locations/index.json',
    './data/locations/index.json',
    'data/locations/index.json',
    '/public/data/locations/index.json'
  ];

  for (const p of possiblePaths) {
    try {
      const res = await fetch(p);
      if (res.ok) {
        const data = await res.json();
        console.log(`✅ Loaded LGD States Index (${data.total_states} States/UTs, ${data.total_records.toLocaleString()} Villages) from: ${p}`);
        return data;
      }
    } catch (e) {
      // try next path
    }
  }
  return null;
}

/**
 * Path helper with fallbacks for state json
 */
async function fetchStateDataset(stateCode) {
  if (window.locationCache[stateCode]) {
    return window.locationCache[stateCode];
  }

  const possiblePaths = [
    `/data/locations/states/${stateCode}.json`,
    `./data/locations/states/${stateCode}.json`,
    `data/locations/states/${stateCode}.json`,
    `/public/data/locations/states/${stateCode}.json`
  ];

  for (const p of possiblePaths) {
    try {
      const res = await fetch(p);
      if (res.ok) {
        const data = await res.json();
        window.locationCache[stateCode] = data;
        console.log(`✅ Lazy-loaded state location data [Code ${stateCode}: ${data.state_name}]`);
        return data;
      }
    } catch (e) {
      // try next path
    }
  }
  return null;
}

/**
 * Initializes the State dropdown on page load
 */
async function loadRealLocationData() {
  const indexData = await fetchIndexDataset();
  if (indexData && indexData.states) {
    window.statesIndex = indexData.states;
    initCascadingLocations();
  } else {
    console.warn('⚠️ LGD Index dataset failed to load.');
    const stateSel = document.getElementById('stateSelect');
    if (stateSel) {
      stateSel.innerHTML = '<option value="">-- Error Loading LGD Locations --</option>';
    }
  }
}

/**
 * Helper to get localized display name for dropdown options
 */
function getLocalizedName(name) {
  if (!name) return '';
  if (typeof getLocalizedLocationName === 'function') {
    return getLocalizedLocationName(name);
  }
  if (typeof locationTranslations !== 'undefined' && locationTranslations[name]) {
    const bcp47 = localStorage.getItem('civic_user_bcp47') || (typeof currentSpeechLang !== 'undefined' ? currentSpeechLang : 'te-IN');
    const langCode = bcp47.split('-')[0].toLowerCase();
    if (locationTranslations[name][langCode]) {
      return `${locationTranslations[name][langCode]} (${name})`;
    }
  }
  return name;
}

/**
 * Populates States dropdown from index
 */
function initCascadingLocations() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');

  if (!stateSel) return;

  stateSel.innerHTML = '<option value="">-- Select State --</option>';

  const sortedStates = [...(window.statesIndex || [])].sort((a, b) => a.name.localeCompare(b.name));

  sortedStates.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st.name;
    opt.setAttribute('data-code', st.code);
    opt.textContent = getLocalizedName(st.name);
    stateSel.appendChild(opt);
  });

  stateSel.value = "";

  if (distSel) {
    distSel.innerHTML = '<option value="">-- Select State First --</option>';
    distSel.disabled = true;
  }
  if (mandalSel) {
    mandalSel.innerHTML = '<option value="">-- Select District First --</option>';
    mandalSel.disabled = true;
  }
  if (villSel) {
    villSel.innerHTML = '<option value="">-- Select Mandal First --</option>';
    villSel.disabled = true;
  }

  const mandalInp = document.getElementById('mandalInput');
  const villInp = document.getElementById('villageInput');
  if (mandalInp) mandalInp.value = "";
  if (villInp) villInp.value = "";
}

/**
 * Handler when State dropdown changes
 */
async function onStateChanged() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');

  if (!stateSel) return;

  const selectedOption = stateSel.options[stateSel.selectedIndex];
  const selectedStateName = stateSel.value;
  const selectedStateCode = selectedOption ? selectedOption.getAttribute('data-code') : '';

  window.selectedLocation = {
    stateName: selectedStateName,
    stateCode: selectedStateCode || '',
    districtName: '',
    districtCode: '',
    mandalName: '',
    mandalCode: '',
    villageName: '',
    villageCode: ''
  };

  if (distSel) {
    distSel.innerHTML = '<option value="">-- Loading Districts... --</option>';
    distSel.disabled = true;
  }
  if (mandalSel) {
    mandalSel.innerHTML = '<option value="">-- Select District First --</option>';
    mandalSel.disabled = true;
  }
  if (villSel) {
    villSel.innerHTML = '<option value="">-- Select Mandal First --</option>';
    villSel.disabled = true;
  }

  const mandalInp = document.getElementById('mandalInput');
  const villInp = document.getElementById('villageInput');
  if (mandalInp) mandalInp.value = "";
  if (villInp) villInp.value = "";

  if (!selectedStateName || !selectedStateCode) {
    if (distSel) distSel.innerHTML = '<option value="">-- Select State First --</option>';
    if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
    return;
  }

  // Lazy load state dataset
  const stateData = await fetchStateDataset(selectedStateCode);

  if (!stateData || !stateData.districts) {
    if (distSel) distSel.innerHTML = '<option value="">-- Error Loading Districts --</option>';
    return;
  }

  if (distSel) {
    distSel.innerHTML = '<option value="">-- Select District --</option>';
    distSel.disabled = false;

    const districtsObj = stateData.districts;
    const districtList = Object.keys(districtsObj).sort();

    districtList.forEach(dist => {
      const opt = document.createElement('option');
      opt.value = dist;
      opt.setAttribute('data-code', districtsObj[dist].code);
      opt.textContent = getLocalizedName(dist);
      distSel.appendChild(opt);
    });
  }

  if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
}

/**
 * Handler when District dropdown changes
 */
function onDistrictChanged() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');

  if (!stateSel || !distSel) return;

  const stateOption = stateSel.options[stateSel.selectedIndex];
  const stateCode = stateOption ? stateOption.getAttribute('data-code') : '';
  const distOption = distSel.options[distSel.selectedIndex];
  const selectedDistName = distSel.value;
  const selectedDistCode = distOption ? distOption.getAttribute('data-code') : '';

  window.selectedLocation.districtName = selectedDistName;
  window.selectedLocation.districtCode = selectedDistCode || '';
  window.selectedLocation.mandalName = '';
  window.selectedLocation.mandalCode = '';
  window.selectedLocation.villageName = '';
  window.selectedLocation.villageCode = '';

  if (mandalSel) {
    mandalSel.innerHTML = '<option value="">-- Select Mandal --</option>';
    mandalSel.disabled = !selectedDistName;
  }
  if (villSel) {
    villSel.innerHTML = '<option value="">-- Select Mandal First --</option>';
    villSel.disabled = true;
  }

  const mandalInp = document.getElementById('mandalInput');
  const villInp = document.getElementById('villageInput');
  if (mandalInp) mandalInp.value = "";
  if (villInp) villInp.value = "";

  const stateData = window.locationCache[stateCode];

  if (!selectedDistName || !stateData || !stateData.districts[selectedDistName]) {
    if (mandalSel) mandalSel.innerHTML = '<option value="">-- Select District First --</option>';
    if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
    return;
  }

  const mandalsObj = stateData.districts[selectedDistName].mandals || {};
  const mandalList = Object.keys(mandalsObj).sort();

  mandalList.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
    opt.setAttribute('data-code', mandalsObj[m].code);
    opt.textContent = getLocalizedName(m);
    mandalSel.appendChild(opt);
  });

  if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
}

/**
 * Handler when Mandal dropdown changes
 */
function onMandalChanged() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');
  const mandalInp = document.getElementById('mandalInput');
  const villInp = document.getElementById('villageInput');

  if (!stateSel || !distSel || !mandalSel) return;

  const stateOption = stateSel.options[stateSel.selectedIndex];
  const stateCode = stateOption ? stateOption.getAttribute('data-code') : '';
  const distName = distSel.value;
  const mandalOption = mandalSel.options[mandalSel.selectedIndex];
  const selectedMandalName = mandalSel.value;
  const selectedMandalCode = mandalOption ? mandalOption.getAttribute('data-code') : '';

  if (mandalInp) mandalInp.value = selectedMandalName;
  if (villInp) villInp.value = "";

  window.selectedLocation.mandalName = selectedMandalName;
  window.selectedLocation.mandalCode = selectedMandalCode || '';
  window.selectedLocation.villageName = '';
  window.selectedLocation.villageCode = '';

  if (villSel) {
    villSel.innerHTML = '<option value="">-- Select Village / Locality --</option>';
    villSel.disabled = !selectedMandalName;
  }

  const stateData = window.locationCache[stateCode];

  if (!selectedMandalName || !stateData || !stateData.districts[distName]?.mandals[selectedMandalName]) {
    if (villSel) villSel.innerHTML = '<option value="">-- Select Mandal First --</option>';
    if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
    return;
  }

  const villagesArr = stateData.districts[distName].mandals[selectedMandalName].villages || [];
  const sortedVillages = [...villagesArr].sort((a, b) => a.name.localeCompare(b.name));

  sortedVillages.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v.name;
    opt.setAttribute('data-code', v.code);
    opt.textContent = getLocalizedName(v.name);
    villSel.appendChild(opt);
  });

  if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
}

/**
 * Handler when Village dropdown changes
 */
function onVillageChanged() {
  const villSel = document.getElementById('villageSelect');
  const villInp = document.getElementById('villageInput');
  if (!villSel) return;

  const selectedOption = villSel.options[villSel.selectedIndex];
  const villName = villSel.value;
  const villCode = selectedOption ? selectedOption.getAttribute('data-code') : '';

  if (villInp) villInp.value = villName;

  window.selectedLocation.villageName = villName;
  window.selectedLocation.villageCode = villCode || '';

  if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
}

// Export functions to global scope
window.loadRealLocationData = loadRealLocationData;
window.initCascadingLocations = initCascadingLocations;
window.onStateChanged = onStateChanged;
window.onDistrictChanged = onDistrictChanged;
window.onMandalChanged = onMandalChanged;
window.onVillageChanged = onVillageChanged;

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadRealLocationData);
} else {
  loadRealLocationData();
}
