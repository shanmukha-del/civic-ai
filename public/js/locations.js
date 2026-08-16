/**
 * CivicAI - Real LGD Administrative Location Module (Andhra Pradesh & Telangana)
 * Source: Official Local Government Directory (LGD) Dataset (As of 2 July 2026)
 */

window.locationData = window.locationData || {};
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
 * Loads real LGD geographical dataset asynchronously from static JSON with path fallbacks
 */
async function loadRealLocationData() {
  const possiblePaths = [
    '/data/locations-ap-ts.json',
    './data/locations-ap-ts.json',
    'data/locations-ap-ts.json',
    '/public/data/locations-ap-ts.json'
  ];

  let loadedData = null;

  for (const path of possiblePaths) {
    try {
      const res = await fetch(path);
      if (res.ok) {
        loadedData = await res.json();
        console.log(`✅ Loaded LGD dataset from path: ${path}`);
        break;
      }
    } catch (e) {
      // try next fallback path
    }
  }

  if (loadedData) {
    window.locationData = loadedData;
    initCascadingLocations();
  } else {
    console.warn('CivicAI location dataset fallback triggered.');
    const stateSel = document.getElementById('stateSelect');
    if (stateSel) {
      stateSel.innerHTML = '<option value="">-- Select Location --</option>';
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
 * Initializes the State dropdown and sets dependent dropdowns to initial disabled state
 */
function initCascadingLocations() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');

  if (!stateSel) return;

  const locData = window.locationData || {};

  stateSel.innerHTML = '<option value="">-- Select State --</option>';
  
  const states = Object.keys(locData).sort();
  states.forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = getLocalizedName(st);
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
function onStateChanged() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');

  const selectedState = stateSel ? stateSel.value : '';
  const locData = window.locationData || {};

  window.selectedLocation = {
    stateName: selectedState,
    stateCode: (selectedState && locData[selectedState]) ? locData[selectedState].state_code : '',
    districtName: '',
    districtCode: '',
    mandalName: '',
    mandalCode: '',
    villageName: '',
    villageCode: ''
  };

  if (distSel) {
    distSel.innerHTML = '<option value="">-- Select District --</option>';
    distSel.disabled = !selectedState;
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

  if (!selectedState || !locData[selectedState]) {
    if (distSel) distSel.innerHTML = '<option value="">-- Select State First --</option>';
    if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
    return;
  }

  const districtsObj = locData[selectedState].districts || {};
  const districtList = Object.keys(districtsObj).sort();

  districtList.forEach(dist => {
    const opt = document.createElement('option');
    opt.value = dist;
    opt.textContent = getLocalizedName(dist);
    distSel.appendChild(opt);
  });

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

  const selectedState = stateSel ? stateSel.value : '';
  const selectedDist = distSel ? distSel.value : '';
  const locData = window.locationData || {};

  window.selectedLocation.districtName = selectedDist;
  if (selectedState && selectedDist && locData[selectedState] && locData[selectedState].districts[selectedDist]) {
    window.selectedLocation.districtCode = locData[selectedState].districts[selectedDist].code;
  } else {
    window.selectedLocation.districtCode = '';
  }
  window.selectedLocation.mandalName = '';
  window.selectedLocation.mandalCode = '';
  window.selectedLocation.villageName = '';
  window.selectedLocation.villageCode = '';

  if (mandalSel) {
    mandalSel.innerHTML = '<option value="">-- Select Mandal --</option>';
    mandalSel.disabled = !selectedDist;
  }
  if (villSel) {
    villSel.innerHTML = '<option value="">-- Select Mandal First --</option>';
    villSel.disabled = true;
  }

  const mandalInp = document.getElementById('mandalInput');
  const villInp = document.getElementById('villageInput');
  if (mandalInp) mandalInp.value = "";
  if (villInp) villInp.value = "";

  if (!selectedState || !selectedDist || !locData[selectedState] || !locData[selectedState].districts[selectedDist]) {
    if (mandalSel) mandalSel.innerHTML = '<option value="">-- Select District First --</option>';
    if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
    return;
  }

  const mandalsObj = locData[selectedState].districts[selectedDist].mandals || {};
  const mandalList = Object.keys(mandalsObj).sort();

  mandalList.forEach(m => {
    const opt = document.createElement('option');
    opt.value = m;
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

  const selectedState = stateSel ? stateSel.value : '';
  const selectedDist = distSel ? distSel.value : '';
  const selectedMandal = mandalSel ? mandalSel.value : '';
  const locData = window.locationData || {};

  if (mandalInp) mandalInp.value = selectedMandal;
  if (villInp) villInp.value = "";

  window.selectedLocation.mandalName = selectedMandal;
  if (selectedState && selectedDist && selectedMandal && locData[selectedState]?.districts[selectedDist]?.mandals[selectedMandal]) {
    window.selectedLocation.mandalCode = locData[selectedState].districts[selectedDist].mandals[selectedMandal].code;
  } else {
    window.selectedLocation.mandalCode = '';
  }
  window.selectedLocation.villageName = '';
  window.selectedLocation.villageCode = '';

  if (villSel) {
    villSel.innerHTML = '<option value="">-- Select Village / Locality --</option>';
    villSel.disabled = !selectedMandal;
  }

  if (!selectedState || !selectedDist || !selectedMandal || !locData[selectedState]?.districts[selectedDist]?.mandals[selectedMandal]) {
    if (villSel) villSel.innerHTML = '<option value="">-- Select Mandal First --</option>';
    if (typeof geocodeLocationAndLocateMap === 'function') geocodeLocationAndLocateMap();
    return;
  }

  const villagesArr = locData[selectedState].districts[selectedDist].mandals[selectedMandal].villages || [];
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
