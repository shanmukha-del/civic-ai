let locationData = {};

// Load real geographical data asynchronously
async function loadRealLocationData() {
  try {
    const res = await fetch('/locations.json');
    locationData = await res.json();
    initCascadingLocations();
  } catch (err) {
    console.error('Failed to load real LGD location dataset:', err);
  }
}

function initCascadingLocations() {
  const stateSel = document.getElementById('stateSelect');
  const distSel = document.getElementById('districtSelect');
  const mandalSel = document.getElementById('mandalSelect');
  const villSel = document.getElementById('villageSelect');
  if (!stateSel) return;

  stateSel.innerHTML = '<option value="">-- Select State --</option>';
  Object.keys(locationData).sort().forEach(st => {
    const opt = document.createElement('option');
    opt.value = st;
    opt.textContent = st;
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
}

// Replace initCascadingLocations() call inside DOMContentLoaded with:
document.addEventListener('DOMContentLoaded', () => {
  // ... other inits ...
  loadRealLocationData();
});