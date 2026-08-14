// Admin Portal Client Logic (CivicAI)

const API_BASE = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ? 'http://localhost:3000'
  : 'https://civic-ai-mnw1.onrender.com';

let previousAdminTotal = 0;
let adminPollingInterval = null;

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

function showProfessionalToastNotification(title, message) {
  let toastContainer = document.getElementById('civicToastContainer');
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.id = 'civicToastContainer';
    toastContainer.className = 'fixed top-4 right-4 z-[99999] flex flex-col space-y-2 pointer-events-none max-w-sm w-full px-4';
    document.body.appendChild(toastContainer);
  }

  const toast = document.createElement('div');
  toast.className = 'p-4 rounded-2xl shadow-2xl border flex items-start space-x-3 pointer-events-auto transform transition-all duration-500 translate-y-0 opacity-100 bg-slate-900 text-white border-amber-500';

  toast.innerHTML = `
    <div class="w-9 h-9 rounded-xl bg-amber-500 text-slate-950 flex items-center justify-center text-lg flex-shrink-0 shadow-md">
      <i class="fa-solid fa-bell animate-pulse"></i>
    </div>
    <div class="flex-grow">
      <h4 class="font-extrabold text-xs tracking-wide uppercase text-amber-400">${title}</h4>
      <p class="text-xs text-slate-200 mt-0.5 leading-snug font-medium">${message}</p>
    </div>
  `;

  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('opacity-0', '-translate-y-2');
    setTimeout(() => toast.remove(), 500);
  }, 6000);
}

document.addEventListener('DOMContentLoaded', () => {
  loadAdminDashboard();
  startAdminAutoPolling();
});

function startAdminAutoPolling() {
  if (adminPollingInterval) clearInterval(adminPollingInterval);
  // Real-time polling every 2 seconds for INSTANT 2-3s admin alert notification
  adminPollingInterval = setInterval(() => {
    loadAnalytics(true);
    loadLogs();
  }, 2000);
}

async function loadAdminDashboard() {
  await loadDepartments();
  await loadOfficers();
  await loadAnalytics();
  await loadLogs();
}

// 1. Analytics & Metrics
async function loadAnalytics(isPoll = false) {
  try {
    const res = await fetch(`${API_BASE}/api/admin/analytics`);
    const data = await res.json();

    if (data.success && data.analytics) {
      const a = data.analytics;
      const currentTotal = parseInt(a.total) || 0;

      if (isPoll && previousAdminTotal > 0 && currentTotal > previousAdminTotal) {
        playProfessionalChimeAlert();
        showProfessionalToastNotification(
          '🏛️ CENTRAL ADMIN SYSTEM ALERT',
          `${currentTotal - previousAdminTotal} new public grievance(s) registered in portal!`
        );
      }
      previousAdminTotal = currentTotal;

      document.getElementById('statTotal').textContent = a.total;
      document.getElementById('statPending').textContent = a.pending;
      document.getElementById('statOngoing').textContent = a.ongoing;
      document.getElementById('statResolved').textContent = a.resolved;
      document.getElementById('statOverdue').textContent = a.overdue;
      document.getElementById('statCompliance').textContent = `${a.onTimeComplianceRate}%`;
    }
  } catch (err) {
    console.error('Error loading analytics:', err);
  }
}

// 2. Fetch & Render Departments
async function loadDepartments() {
  try {
    const res = await fetch(`${API_BASE}/api/departments`);
    const data = await res.json();
    
    if (data.success) {
      const container = document.getElementById('departmentsContainer');
      const selectEl = document.getElementById('offDepartment');
      
      container.innerHTML = '';
      selectEl.innerHTML = '<option value="">-- Select Department --</option>';

      data.departments.forEach(dept => {
        const card = document.createElement('div');
        card.className = 'p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between shadow-xs';
        card.innerHTML = `
          <div class="flex items-center space-x-2.5">
            <div class="w-8 h-8 bg-teal-100 text-teal-800 rounded-lg flex items-center justify-center font-bold text-xs">
              ${dept.id}
            </div>
            <span class="font-bold text-xs text-slate-800">${dept.name}</span>
          </div>
          <button onclick="handleDeleteDepartment(${dept.id})" title="Delete Department" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition flex items-center space-x-1">
            <i class="fa-solid fa-trash-can text-xs"></i>
            <span>Delete</span>
          </button>
        `;
        container.appendChild(card);

        const opt = document.createElement('option');
        opt.value = dept.id;
        opt.textContent = dept.name;
        selectEl.appendChild(opt);
      });
    }
  } catch (err) {
    console.error('Error loading departments:', err);
  }
}

async function handleAddDepartment(e) {
  e.preventDefault();
  const nameInput = document.getElementById('newDeptName');
  const name = nameInput.value.trim();

  if (!name) return;

  try {
    const res = await fetch(`${API_BASE}/api/departments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const data = await res.json();

    if (data.success) {
      nameInput.value = '';
      await loadDepartments();
      alert('Department added successfully!');
    } else {
      alert('Error: ' + data.error);
    }
  } catch (err) {
    alert('Failed to add department.');
  }
}

async function handleDeleteDepartment(id) {
  if (!confirm(`Are you sure you want to delete Department #${id}? This will also delete it permanently from the database.`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/departments/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      alert('Department deleted from database successfully.');
      await loadDepartments();
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Failed to delete department.');
  }
}

// 3. Fetch & Render Officers
async function loadOfficers() {
  try {
    const res = await fetch(`${API_BASE}/api/officers`);
    const data = await res.json();

    if (data.success) {
      const tbody = document.getElementById('officersTableBody');
      tbody.innerHTML = '';

      data.officers.forEach(off => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
          <td class="p-2.5 font-mono font-bold text-teal-900">#${off.id}</td>
          <td class="p-2.5 font-bold text-slate-900">${off.name}</td>
          <td class="p-2.5 font-semibold text-slate-700">
            <div>${off.email || 'N/A'}</div>
            <div class="text-emerald-700 text-[11px]">+91 ${off.mobile}</div>
          </td>
          <td class="p-2.5 font-semibold text-slate-800">${off.departments ? off.departments.name : 'Dept #' + off.department_id}</td>
          <td class="p-2.5 font-medium text-slate-700">${off.village}, ${off.mandal} (${off.district})</td>
          <td class="p-2.5 font-mono text-slate-600">${off.username}</td>
          <td class="p-2.5">
            <button onclick="handleDeleteOfficer(${off.id})" title="Delete Officer" class="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold border border-rose-200 transition flex items-center space-x-1">
              <i class="fa-solid fa-trash-can text-xs"></i>
              <span>Delete</span>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error loading officers:', err);
  }
}

async function handleOnboardOfficer(e) {
  e.preventDefault();
  
  const payload = {
    name: document.getElementById('offName').value.trim(),
    mobile: document.getElementById('offMobile').value.trim(),
    email: document.getElementById('offEmail').value.trim(),
    department_id: document.getElementById('offDepartment').value,
    village: document.getElementById('offVillage').value.trim(),
    mandal: document.getElementById('offMandal').value.trim(),
    district: document.getElementById('offDistrict').value.trim(),
    state: document.getElementById('offState').value.trim(),
    username: document.getElementById('offUsername').value.trim(),
    password: document.getElementById('offPassword').value.trim()
  };

  try {
    const res = await fetch(`${API_BASE}/api/officers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      alert('Field Officer onboarded successfully! Onboarding email dispatched.');
      e.target.reset();
      await loadOfficers();
      await loadAnalytics();
    } else {
      alert('Onboarding failed: ' + data.error);
    }
  } catch (err) {
    alert('Failed to onboard officer.');
  }
}

async function handleDeleteOfficer(id) {
  if (!confirm(`Are you sure you want to delete Officer #${id}? This will remove officer credentials permanently from the database.`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/officers/${id}`, { method: 'DELETE' });
    const data = await res.json();

    if (data.success) {
      alert('Officer deleted from database successfully.');
      await loadOfficers();
      await loadAnalytics();
    } else {
      alert('Delete failed: ' + data.error);
    }
  } catch (err) {
    alert('Failed to delete officer.');
  }
}

// 4. Fetch Audit Logs
async function loadLogs() {
  try {
    const res = await fetch(`${API_BASE}/api/admin/logs`);
    const data = await res.json();

    if (data.success && data.logs) {
      const tbody = document.getElementById('logsTableBody');
      tbody.innerHTML = '';

      data.logs.forEach(log => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-slate-50 transition';
        tr.innerHTML = `
          <td class="p-2.5 font-mono text-teal-900">#${log.id}</td>
          <td class="p-2.5 text-slate-500 font-mono text-[11px]">${new Date(log.created_at).toLocaleString('en-IN')}</td>
          <td class="p-2.5 font-bold text-slate-800">${log.event_type}</td>
          <td class="p-2.5 font-bold"><span class="bg-slate-100 text-slate-800 px-2 py-0.5 rounded text-[10px] border border-slate-200">${log.actor_role}</span></td>
          <td class="p-2.5 text-slate-800 font-semibold">${log.description}</td>
        `;
        tbody.appendChild(tr);
      });
    }
  } catch (err) {
    console.error('Error loading logs:', err);
  }
}

function switchAdminTab(tabName) {
  const deptTab = document.getElementById('tabDeptContent');
  const officerTab = document.getElementById('tabOfficerContent');
  const logsTab = document.getElementById('tabLogsContent');

  const deptBtn = document.getElementById('tabDeptBtn');
  const officerBtn = document.getElementById('tabOfficerBtn');
  const logsBtn = document.getElementById('tabLogsBtn');

  [deptTab, officerTab, logsTab].forEach(t => t.classList.add('hidden'));
  [deptBtn, officerBtn, logsBtn].forEach(b => b.className = 'py-3 px-4 text-xs font-extrabold text-slate-500 hover:text-teal-900 flex items-center space-x-1.5');

  if (tabName === 'dept') {
    deptTab.classList.remove('hidden');
    deptBtn.className = 'py-3 px-4 text-xs font-extrabold text-teal-900 border-b-2 border-teal-900 flex items-center space-x-1.5';
  } else if (tabName === 'officer') {
    officerTab.classList.remove('hidden');
    officerBtn.className = 'py-3 px-4 text-xs font-extrabold text-teal-900 border-b-2 border-teal-900 flex items-center space-x-1.5';
  } else if (tabName === 'logs') {
    logsTab.classList.remove('hidden');
    logsBtn.className = 'py-3 px-4 text-xs font-extrabold text-teal-900 border-b-2 border-teal-900 flex items-center space-x-1.5';
    loadLogs();
  }
}
