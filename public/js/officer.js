
function toggleCustomDeadlineInput(val) {
  const dtBox = document.getElementById('customDateTimeBox');
  const hrBox = document.getElementById('customHoursBox');

  if (dtBox) dtBox.classList.add('hidden');
  if (hrBox) hrBox.classList.add('hidden');

  if (val === 'custom_datetime' && dtBox) {
    dtBox.classList.remove('hidden');
  } else if (val === 'custom_hours' && hrBox) {
    hrBox.classList.remove('hidden');
  }
}
// Officer Portal Client Logic (CivicAI)

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://civic-ai-mnw1.onrender.com';

let loggedInOfficer = null;
let allOfficerComplaints = [];
let currentCardFilter = 'PENDING';

document.addEventListener('DOMContentLoaded', () => {
  const savedOfficer = localStorage.getItem('civic_officer_session');
  if (savedOfficer) {
    try {
      loggedInOfficer = JSON.parse(savedOfficer);
      if (loggedInOfficer.is_first_login) {
        showFirstSetupModal();
      } else {
        showOfficerDashboard();
      }
    } catch (e) {
      showLoginModal();
    }
  } else {
    showLoginModal();
  }
});

function showLoginModal() {
  document.getElementById('officerLoginModal').classList.remove('hidden');
  document.getElementById('officerDashboard').classList.add('hidden');
  document.getElementById('firstSetupModal').classList.add('hidden');
}

function showFirstSetupModal() {
  document.getElementById('officerLoginModal').classList.add('hidden');
  document.getElementById('officerDashboard').classList.add('hidden');
  document.getElementById('firstSetupModal').classList.remove('hidden');
}

async function showOfficerDashboard() {
  document.getElementById('officerLoginModal').classList.add('hidden');
  document.getElementById('firstSetupModal').classList.add('hidden');
  document.getElementById('officerDashboard').classList.remove('hidden');

  document.getElementById('offHeaderName').textContent = loggedInOfficer.name;
  document.getElementById('offHeaderJurisdiction').textContent = `Jurisdiction: ${loggedInOfficer.village}, ${loggedInOfficer.mandal} (${loggedInOfficer.district})`;

  let deptName = loggedInOfficer.departments ? loggedInOfficer.departments.name : null;

  if (!deptName && loggedInOfficer.department_id) {
    try {
      const res = await fetch(`${API_BASE}/api/departments`);
      const data = await res.json();
      if (data.success && data.departments) {
        const found = data.departments.find(d => parseInt(d.id) === parseInt(loggedInOfficer.department_id));
        if (found) deptName = found.name;
      }
    } catch (e) {}
  }

  document.getElementById('offHeaderDept').textContent = deptName || `Department (${loggedInOfficer.department_id})`;

  refreshOfficerComplaints();
  startOfficerAutoPolling();
}

// 1. Login Handler
async function handleOfficerLogin(e) {
  e.preventDefault();
  const username = document.getElementById('loginUsername').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/officers/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      loggedInOfficer = data.officer;
      localStorage.setItem('civic_officer_session', JSON.stringify(loggedInOfficer));
      
      if (loggedInOfficer.is_first_login) {
        showFirstSetupModal();
      } else {
        showOfficerDashboard();
      }
    } else {
      alert('Login Failed: ' + data.error);
    }
  } catch (err) {
    alert('Network error during login.');
  }
}

// 2. First-Time Setup Password Handler
async function handleFirstSetupPassword(e) {
  e.preventDefault();
  const newPassword = document.getElementById('newPermPassword').value.trim();
  const confirmPassword = document.getElementById('confirmPermPassword').value.trim();

  if (newPassword !== confirmPassword) {
    alert('Passwords do not match. Please re-enter.');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/officers/setup-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: loggedInOfficer.username, newPassword })
    });
    const data = await res.json();

    if (data.success) {
      loggedInOfficer = data.officer;
      localStorage.setItem('civic_officer_session', JSON.stringify(loggedInOfficer));
      alert('Permanent credentials setup successful!');
      showOfficerDashboard();
    } else {
      alert('Setup failed: ' + data.error);
    }
  } catch (err) {
    alert('Network error setup password.');
  }
}

function logoutOfficer() {
  localStorage.removeItem('civic_officer_session');
  loggedInOfficer = null;
  showLoginModal();
}

let knownComplaintIds = new Set();
let officerPollingInterval = null;

function playProfessionalChimeAlert() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();

    // High Crisp Tone 1 (E6 - 1318.5 Hz)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(1318.5, ctx.currentTime);
    gain1.gain.setValueAtTime(0.18, ctx.currentTime);
    gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.35);

    // Warm Harmonious Tone 2 (B6 - 1975.5 Hz) - Delay 120ms
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(1975.5, ctx.currentTime + 0.12);
    gain2.gain.setValueAtTime(0.22, ctx.currentTime + 0.12);
    gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.55);
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    osc2.start(ctx.currentTime + 0.12);
    osc2.stop(ctx.currentTime + 0.55);
  } catch (e) {}
}

function showProfessionalToastNotification(title, message, isEmergency = false) {
  let toastContainer = document.getElementById('civicToastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'civicToastContainer';
    toastContainer.className = 'fixed top-4 right-4 z-[99999] flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = `p-4 rounded-2xl shadow-2xl border flex items-start space-x-3 pointer-events-auto transform transition-all duration-500 translate-y-0 opacity-100 ${
    isEmergency ? 'bg-rose-900 text-white border-rose-500' : 'bg-slate-900 text-white border-teal-500'
  }`;

  toast.innerHTML = `
    <div class="w-9 h-9 rounded-xl ${isEmergency ? 'bg-rose-700 text-rose-100' : 'bg-teal-700 text-amber-300'} flex items-center justify-center text-lg flex-shrink-0 shadow-md">
      <i class="fa-solid ${isEmergency ? 'fa-triangle-exclamation animate-bounce' : 'fa-bell animate-pulse'}"></i>
    </div>
    <div class="flex-grow">
      <h4 class="font-extrabold text-xs tracking-wide uppercase ${isEmergency ? 'text-rose-200' : 'text-amber-400'}">${title}</h4>
      <p class="text-xs text-slate-200 mt-0.5 leading-snug font-medium">${message}</p>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

function startOfficerAutoPolling() {
  if (officerPollingInterval) clearInterval(officerPollingInterval);
  // Real-time polling every 2 seconds for INSTANT 2-3s officer alert notification
  officerPollingInterval = setInterval(() => {
    if (loggedInOfficer) {
      refreshOfficerComplaints(true);
    }
  }, 2000);
}

// 3. Fetch Officer Complaints
async function refreshOfficerComplaints(isPoll = false) {
  if (!loggedInOfficer) return;

  const village = loggedInOfficer.village;
  const mandal = loggedInOfficer.mandal;
  const category_id = loggedInOfficer.department_id;

  try {
    const query = `village=${encodeURIComponent(village)}&mandal=${encodeURIComponent(mandal)}&category_id=${category_id}`;
    const res = await fetch(`${API_BASE}/api/complaints?${query}`);
    const data = await res.json();

    if (data.success) {
      allOfficerComplaints = data.complaints || [];

      // Detect new complaints during continuous background polling
      let hasNewIncident = false;
      let latestNewComplaint = null;

      allOfficerComplaints.forEach(c => {
        const idStr = String(c.id || c.tracking_id);
        if (!knownComplaintIds.has(idStr)) {
          if (knownComplaintIds.size > 0 && isPoll) {
            hasNewIncident = true;
            latestNewComplaint = c;
          }
          knownComplaintIds.add(idStr);
        }
      });

      if (hasNewIncident && latestNewComplaint) {
        playProfessionalChimeAlert();
        const isEmergency = latestNewComplaint.severity === 'EMERGENCY';
        showProfessionalToastNotification(
          isEmergency ? '🚨 EMERGENCY INCIDENT ASSIGNED' : '🔔 NEW INCIDENT ASSIGNED',
          `Incident #${latestNewComplaint.tracking_id || latestNewComplaint.id} reported in ${latestNewComplaint.village || 'your jurisdiction'}.`,
          isEmergency
        );
      }

      const pendingList = allOfficerComplaints.filter(c => c.status === 'PENDING');
      const ongoingList = allOfficerComplaints.filter(c => c.status === 'ONGOING' || c.status === 'DISPATCHED');
      const resolvedList = allOfficerComplaints.filter(c => c.status === 'RESOLVED');
      const overdueList = allOfficerComplaints.filter(c => c.status === 'OVERDUE');
      const emergencyList = allOfficerComplaints.filter(c => c.severity === 'EMERGENCY');

      document.getElementById('countPending').textContent = pendingList.length;
      document.getElementById('countOngoing').textContent = ongoingList.length;
      document.getElementById('countResolved').textContent = resolvedList.length;
      document.getElementById('countOverdue').textContent = overdueList.length;

      const emergencyBanner = document.getElementById('emergencyBanner');
      if (emergencyList.length > 0) {
        emergencyBanner.classList.remove('hidden');
      } else {
        emergencyBanner.classList.add('hidden');
      }

      renderComplaintsGrid();
    }
  } catch (err) {
    console.error('Error fetching officer complaints:', err);
  }
}

function switchOfficerCardFilter(cardType) {
  currentCardFilter = cardType;

  ['Pending', 'Ongoing', 'Resolved', 'Overdue'].forEach(type => {
    const el = document.getElementById(`card${type}`);
    if (el) {
      el.className = 'bg-white p-5 rounded-2xl border-2 border-slate-200 shadow-sm cursor-pointer hover:border-teal-700 transition transform flex items-center justify-between opacity-80';
    }
  });

  const selectedEl = document.getElementById(`card${cardType.charAt(0) + cardType.slice(1).toLowerCase()}`);
  if (selectedEl) {
    selectedEl.className = 'bg-white p-5 rounded-2xl border-2 border-teal-800 shadow-md cursor-pointer transition transform scale-[1.02] flex items-center justify-between opacity-100 ring-2 ring-teal-500/30';
  }

  renderComplaintsGrid();
}

function renderComplaintsGrid() {
  const container = document.getElementById('complaintsGrid');
  const emptyState = document.getElementById('emptyState');

  let filtered = [];
  if (currentCardFilter === 'PENDING') {
    filtered = allOfficerComplaints.filter(c => c.status === 'PENDING');
  } else if (currentCardFilter === 'ONGOING') {
    filtered = allOfficerComplaints.filter(c => c.status === 'ONGOING' || c.status === 'DISPATCHED');
  } else if (currentCardFilter === 'RESOLVED') {
    filtered = allOfficerComplaints.filter(c => c.status === 'RESOLVED');
  } else if (currentCardFilter === 'OVERDUE') {
    filtered = allOfficerComplaints.filter(c => c.status === 'OVERDUE');
  }

  container.innerHTML = '';

  if (filtered.length === 0) {
    emptyState.classList.remove('hidden');
    return;
  }
  emptyState.classList.add('hidden');

  filtered.forEach(c => {
    const card = document.createElement('div');
    
    let borderClass = 'border-slate-200';
    let badgeBg = 'bg-slate-100 text-slate-800 border-slate-300';
    
    if (c.severity === 'EMERGENCY') {
      borderClass = 'border-2 border-rose-500 shadow-md';
      badgeBg = 'bg-rose-100 text-rose-800 border-rose-300 font-bold';
    } else if (c.severity === 'MODERATE') {
      borderClass = 'border-2 border-amber-400 shadow-sm';
      badgeBg = 'bg-amber-100 text-amber-900 border-amber-300 font-bold';
    } else {
      borderClass = 'border border-emerald-300';
      badgeBg = 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold';
    }

    const mapsUrl = `https://www.google.com/maps?q=${c.latitude},${c.longitude}`;
    const trackingId = c.tracking_id || c.id;
    const whatsappMsg = `CIVICAI UPDATE FOR TRACKING ID #${trackingId}\n\nCategory: ${c.category_name || c.departments?.name}\nSeverity: ${c.severity}\nLocation: ${c.village}, ${c.mandal}\nSummary: ${c.ai_summary || c.original_note}\n\nAssigned Officer: ${loggedInOfficer.name} (${loggedInOfficer.mobile})`;
    const whatsappURL = `https://api.whatsapp.com/send?phone=91${c.citizen_mobile}&text=${encodeURIComponent(whatsappMsg)}`;

    let actionBtnHtml = '';
    if (c.status === 'PENDING') {
      actionBtnHtml = `
        <button onclick="openAcceptModal(${c.id})" class="w-full py-2.5 bg-teal-900 hover:bg-teal-800 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center space-x-1.5">
          <i class="fa-solid fa-check"></i>
          <span>Accept Complaint & Set Deadline</span>
        </button>
      `;
    } else if (c.status === 'ONGOING' || c.status === 'DISPATCHED' || c.status === 'OVERDUE') {
      actionBtnHtml = `
        <div class="grid grid-cols-2 gap-2">
          <button onclick="openUpdateModal(${c.id}, '${c.detected_language}')" class="py-2.5 bg-teal-50 hover:bg-teal-100 text-teal-900 rounded-xl font-bold text-xs border border-teal-300 transition flex items-center justify-center space-x-1">
            <i class="fa-solid fa-comment-medical"></i>
            <span>Add Update</span>
          </button>
          <button onclick="handleMarkResolved(${c.id})" class="py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs shadow transition flex items-center justify-center space-x-1">
            <i class="fa-solid fa-circle-check"></i>
            <span>Mark Resolved</span>
          </button>
        </div>
      `;
    } else {
      actionBtnHtml = `
        <div class="bg-emerald-50 border border-emerald-200 text-emerald-800 p-2 rounded-xl text-center text-xs font-bold">
          Complaint Resolved
        </div>
      `;
    }

    let issuesHtml = '';
    if (c.detected_issues && Array.isArray(c.detected_issues) && c.detected_issues.length > 0) {
      const issueItems = c.detected_issues.map(iss => `
        <div class="flex items-center justify-between text-[11px] py-1 border-b border-slate-100 last:border-0">
          <span class="font-medium ${parseInt(iss.category_id) === parseInt(loggedInOfficer.department_id) ? 'font-extrabold text-teal-900 ring-1 ring-teal-500/40 px-1.5 py-0.5 rounded bg-teal-50' : 'text-slate-700'}">
            ${iss.category_name}: ${iss.problem}
          </span>
          <span class="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${iss.status === 'RESOLVED' ? 'bg-emerald-100 text-emerald-800' : (iss.status === 'ONGOING' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800')}">
            ${iss.status}
          </span>
        </div>
      `).join('');

      issuesHtml = `
        <div class="bg-gradient-to-r from-teal-50 to-emerald-50 p-3 rounded-xl border border-teal-200 text-xs mb-3">
          <div class="text-[10px] font-extrabold uppercase tracking-wider text-teal-900 mb-1.5 flex items-center justify-between">
            <span><i class="fa-solid fa-list-check text-teal-700 mr-1"></i> Multi-Issue Department Routing (${c.detected_issues.length} Issues Extracted)</span>
          </div>
          <div class="space-y-0.5">${issueItems}</div>
        </div>
      `;
    }

    card.className = `bg-white rounded-2xl p-5 ${borderClass} flex flex-col justify-between space-y-4`;
    card.innerHTML = `
      <div>
        <div class="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
          <div class="flex items-center space-x-2">
            <span class="font-mono font-black text-slate-900 text-base">#${trackingId}</span>
            <span class="text-[10px] px-2 py-0.5 rounded-full border ${badgeBg}">${c.severity}</span>
          </div>
          <span class="text-[10px] font-semibold text-slate-500">${new Date(c.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>

        <div class="flex items-center justify-between mb-3 text-xs">
          <div class="font-semibold text-slate-700">
            Citizen: <span class="font-bold text-slate-900">+91 ${c.citizen_mobile}</span>
          </div>
          <a href="tel:${c.citizen_mobile}" class="inline-flex items-center space-x-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-lg font-bold border border-emerald-200 transition text-[11px]">
            <i class="fa-solid fa-phone"></i>
            <span>Call Citizen</span>
          </a>
        </div>

        <div class="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs mb-3">
          <div class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1 flex items-center justify-between">
            <span>Voice / Text Transcript</span>
            <span class="bg-teal-100 text-teal-900 px-1.5 py-0.5 rounded font-mono text-[9px]">${c.detected_language || 'Native'}</span>
          </div>
          <p class="text-slate-800 font-medium italic">"${c.original_note}"</p>
        </div>

        ${issuesHtml}

        <div class="bg-blue-50/70 p-3 rounded-xl border border-blue-200 text-xs">
          <div class="text-[10px] font-bold uppercase tracking-wider text-blue-800 mb-1 flex items-center space-x-1">
            <i class="fa-solid fa-brain"></i>
            <span>Gemini AI Action Directives</span>
          </div>
          <p class="text-slate-800 font-semibold leading-relaxed">${c.ai_summary || 'Analysis pending.'}</p>
        </div>
      </div>

      <div class="pt-3 border-t border-slate-100 space-y-2.5">
        <div class="grid grid-cols-3 gap-1.5 text-center text-xs font-bold">
          <a href="${mapsUrl}" target="_blank" class="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition flex flex-col items-center justify-center p-1">
            <i class="fa-solid fa-map-location-dot text-teal-800 text-base mb-0.5"></i>
            <span class="text-[10px]">Google Maps</span>
          </a>

          <a href="${API_BASE}/api/complaints/download-pdf/${c.tracking_id || c.id}" target="_blank" class="py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-lg border border-slate-300 transition flex flex-col items-center justify-center p-1">
            <i class="fa-solid fa-file-pdf text-rose-600 text-base mb-0.5"></i>
            <span class="text-[10px]">Download PDF</span>
          </a>

          <a href="${whatsappURL}" target="_blank" class="py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300 transition flex flex-col items-center justify-center p-1">
            <i class="fa-brands fa-whatsapp text-emerald-600 text-base mb-0.5"></i>
            <span class="text-[10px]">WhatsApp Citizen</span>
          </a>
        </div>

        ${actionBtnHtml}
      </div>
    `;

    container.appendChild(card);
  });
}

function openAcceptModal(id) {
  document.getElementById('acceptComplaintId').value = id;
  document.getElementById('acceptModal').classList.remove('hidden');
}

function closeAcceptModal() {
  document.getElementById('acceptModal').classList.add('hidden');
}

async function handleConfirmAccept(e) {
  e.preventDefault();
  const id = document.getElementById('acceptComplaintId').value;
  const deadlineVal = document.getElementById('deadlineSelect').value;

  let deadline_hours = null;
  let custom_deadline_datetime = null;

  if (deadlineVal === 'custom_datetime') {
    const dtInput = document.getElementById('customDeadlineDateTime').value;
    if (!dtInput) {
      alert('Please select a valid custom date & time.');
      return;
    }
    custom_deadline_datetime = dtInput;
  } else if (deadlineVal === 'custom_hours') {
    const hrInput = document.getElementById('customDeadlineHoursInput').value;
    if (!hrInput || parseFloat(hrInput) <= 0) {
      alert('Please enter valid custom deadline hours.');
      return;
    }
    deadline_hours = parseFloat(hrInput);
  } else {
    deadline_hours = parseFloat(deadlineVal);
  }

  try {
    const res = await fetch(`${API_BASE}/api/complaints/${id}/accept`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officer_id: loggedInOfficer.id, deadline_hours, custom_deadline_datetime })
    });
    const data = await res.json();

    closeAcceptModal();
    if (data.success) {
      alert('Complaint accepted! Custom target deadline assigned successfully.');
      await refreshOfficerComplaints();
    } else {
      alert('Error accepting complaint: ' + data.error);
    }
  } catch (err) {
    alert('Failed to accept complaint.');
  }
}

function openUpdateModal(id, targetLang) {
  document.getElementById('updateComplaintId').value = id;
  document.getElementById('updateCitizenLang').value = targetLang || 'Telugu';
  document.getElementById('officerUpdateNote').value = '';
  document.getElementById('updateModal').classList.remove('hidden');
}

function closeUpdateModal() {
  document.getElementById('updateModal').classList.add('hidden');
}

async function handleConfirmUpdate(e) {
  e.preventDefault();
  const id = document.getElementById('updateComplaintId').value;
  const update_text = document.getElementById('officerUpdateNote').value.trim();
  const target_language = document.getElementById('updateCitizenLang').value;

  try {
    const res = await fetch(`${API_BASE}/api/complaints/${id}/update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officer_id: loggedInOfficer.id, update_text, target_language })
    });
    const data = await res.json();

    closeUpdateModal();
    if (data.success) {
      let alertMsg = `Update saved! Gemini translated into ${target_language}: "${data.translated_text}"`;
      if (data.whatsapp_url) {
        if (confirm(`${alertMsg}\n\nDo you want to send this update directly to Citizen WhatsApp (+91 ${data.citizen_mobile})?`)) {
          window.open(data.whatsapp_url, '_blank');
        }
      } else {
        alert(alertMsg);
      }
      await refreshOfficerComplaints();
    } else {
      alert('Error saving update: ' + data.error);
    }
  } catch (err) {
    alert('Failed to save update.');
  }
}

async function handleMarkResolved(id) {
  if (!confirm('Are you sure you want to mark this complaint RESOLVED?')) return;

  try {
    const res = await fetch(`${API_BASE}/api/complaints/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ officer_id: loggedInOfficer.id })
    });
    const data = await res.json();

    if (data.success) {
      alert('Complaint marked RESOLVED successfully!');
      await refreshOfficerComplaints();
    } else {
      alert('Error resolving complaint: ' + data.error);
    }
  } catch (err) {
    alert('Failed to resolve complaint.');
  }
}
