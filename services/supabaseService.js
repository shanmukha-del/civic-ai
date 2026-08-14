
function cleanLocationName(str) {
  if (!str) return 'Chittoor';
  let s = String(str);
  if (/[\u0900-\u097F]/.test(s) || s.includes('चित्तूर') || s.includes('??')) {
    return 'Chittoor';
  }
  const cleaned = s.replace(/[^\x00-\x7F]/g, '').trim();
  return cleaned || 'Chittoor';
}
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

let supabase = null;
let isMockMode = false;

if (supabaseUrl && supabaseKey && !supabaseUrl.includes('your-supabase')) {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
    console.log('✅ Connected to Supabase PostgreSQL Database.');
  } catch (err) {
    console.warn('⚠️ Supabase connection failed. Falling back to local in-memory DB mode.', err.message);
    isMockMode = true;
  }
} else {
  console.log('ℹ️ Supabase environment variables not configured. Operating in Local In-Memory DB Mode.');
  isMockMode = true;
}

// In-Memory Database Store (Fallback Engine)
const mockDB = {
  departments: [
    { id: 1, name: 'Water Supply', created_at: new Date().toISOString() },
    { id: 2, name: 'Electricity Board', created_at: new Date().toISOString() },
    { id: 3, name: 'Roads & Infrastructure', created_at: new Date().toISOString() },
    { id: 4, name: 'Sanitation & Waste Management', created_at: new Date().toISOString() },
    { id: 5, name: 'Drainage Management', created_at: new Date().toISOString() }
  ],
  officers: [
    {
      id: 1,
      name: 'P. Srinivas Rao',
      mobile: '9848011222',
      email: 'srinivas.water@civicai.gov.in',
      department_id: 1,
      village: 'Penumur',
      mandal: 'Penumur',
      district: 'Chittoor',
      pincode: '517126',
      state: 'Andhra Pradesh',
      username: 'water_officer',
      password: 'pass123',
      is_first_login: true,
      created_at: new Date().toISOString()
    },

    {
      id: 1,
      name: 'Ramesh Kumar',
      mobile: '9876543210',
      email: 'ramesh.water@civicai.gov.in',
      department_id: 1,
      village: 'Kuppam',
      mandal: 'Kuppam',
      district: 'Chittoor',
      pincode: '517425',
      state: 'Andhra Pradesh',
      username: 'officer1',
      password: 'pass123',
      is_first_login: true,
      created_at: new Date().toISOString()
    },
    {
      id: 2,
      name: 'kambham shanmukhaswaroop',
      mobile: '9987654321',
      email: 'ksavithri462@gmail.com',
      department_id: 2,
      village: 'Sanjiviravanipalle',
      mandal: 'Puthalapattu',
      district: 'Chittoor',
      pincode: '517425',
      state: 'Andhra Pradesh',
      username: 'shanmuk',
      password: '123456',
      is_first_login: false,
      created_at: new Date().toISOString()
    },
    {
      id: 3,
      name: 'Venkat Reddy',
      mobile: '9948011223',
      email: 'venkat.roads@civicai.gov.in',
      department_id: 3,
      village: 'Penumur',
      mandal: 'Penumur',
      district: 'Chittoor',
      pincode: '517126',
      state: 'Andhra Pradesh',
      username: 'road_officer',
      password: 'pass123',
      is_first_login: true,
      created_at: new Date().toISOString()
    },
    {
      id: 4,
      name: 'K. Venkatesh',
      mobile: '9849012345',
      email: 'venkatesh.sanitation@civicai.gov.in',
      department_id: 4,
      village: 'Penumur',
      mandal: 'Penumur',
      district: 'Chittoor',
      pincode: '517126',
      state: 'Andhra Pradesh',
      username: 'sanitation_officer',
      password: 'pass123',
      is_first_login: true,
      created_at: new Date().toISOString()
    },
    {
      id: 5,
      name: 'Gadda Ganesh',
      mobile: '9948023121',
      email: 'ganesh.drainage@civicai.gov.in',
      department_id: 5,
      village: 'Penumur',
      mandal: 'Penumur',
      district: 'Chittoor',
      pincode: '517126',
      state: 'Andhra Pradesh',
      username: 'drainage_officer',
      password: 'pass123',
      is_first_login: true,
      created_at: new Date().toISOString()
    }
  ],
  complaints: [],
  complaint_updates: [],
  activity_logs: [],
  notifications: []
};

let nextDeptId = 6;
let nextOfficerId = 3;
let nextComplaintId = 101;
let nextUpdateId = 1;
let nextLogId = 1;

// Helper: Generate Unique 8-Digit Numeric Tracking ID
function generateNumericTrackingId() {
  return Math.floor(10000000 + Math.random() * 90000000);
}

// Log Activity
async function logActivity(eventType, description, actorRole = 'SYSTEM', actorId = null, complaintId = null) {
  const logEntry = {
    id: nextLogId++,
    event_type: eventType,
    description: description,
    actor_role: actorRole,
    actor_id: actorId ? String(actorId) : null,
    complaint_id: complaintId ? parseInt(complaintId) : null,
    created_at: new Date().toISOString()
  };

  if (!isMockMode && supabase) {
    try {
      await supabase.from('activity_logs').insert([logEntry]);
    } catch (e) {}
  }
  mockDB.activity_logs.unshift(logEntry);
  return logEntry;
}

// Helper: Check Overdue Status for Complaints
function checkAndUpdateOverdueStatus(complaint) {
  if (complaint.status !== 'RESOLVED' && complaint.deadline_at) {
    const deadline = new Date(complaint.deadline_at);
    if (new Date() > deadline) {
      complaint.status = 'OVERDUE';
    }
  }
  return complaint;
}

// --- DEPARTMENTS ---
async function getDepartments() {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase.from('departments').select('*').order('id', { ascending: true });
    if (!error && data) return data;
  }
  return mockDB.departments;
}

async function addDepartment(name) {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase.from('departments').insert([{ name }]).select();
    if (error) throw error;
    await logActivity('DEPARTMENT_CREATED', `New Department created: ${name}`, 'ADMIN');
    return data[0];
  }
  const exists = mockDB.departments.find(d => d.name.toLowerCase() === name.toLowerCase());
  if (exists) throw new Error('Department already exists.');
  const newDept = { id: nextDeptId++, name, created_at: new Date().toISOString() };
  mockDB.departments.push(newDept);
  await logActivity('DEPARTMENT_CREATED', `New Department created: ${name}`, 'ADMIN');
  return newDept;
}

// --- OFFICERS ---
async function getOfficers() {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from('officers')
      .select('*, departments(name)')
      .order('id', { ascending: false });
    if (!error && data) return data;
  }
  return mockDB.officers.map(off => ({
    ...off,
    departments: mockDB.departments.find(d => d.id === off.department_id) || { name: 'Unknown' }
  }));
}

async function addOfficer(officerData) {
  const { name, mobile, email, department_id, village, mandal, district, pincode, state, username, password } = officerData;

  if (!isMockMode && supabase) {
    const { data, error } = await supabase.from('officers').insert([{
      name, mobile, email: email || `${username}@civicai.gov.in`, department_id: parseInt(department_id),
      village, mandal, district: district || 'Chittoor', pincode: pincode || '517425', state: state || 'Andhra Pradesh',
      username, password, is_first_login: true
    }]).select();
    if (error) throw error;
    await logActivity('OFFICER_ONBOARDED', `Field Officer onboarded: ${name} (${village}, ${mandal})`, 'ADMIN');
    return data[0];
  }

  const existing = mockDB.officers.find(o => 
    o.village.toLowerCase() === village.toLowerCase() &&
    o.mandal.toLowerCase() === mandal.toLowerCase() &&
    parseInt(o.department_id) === parseInt(department_id)
  );

  if (existing) {
    throw new Error(`An officer is already assigned to ${village}, ${mandal} for this department.`);
  }

  const newOfficer = {
    id: nextOfficerId++,
    name, mobile, email: email || `${username}@civicai.gov.in`, department_id: parseInt(department_id),
    village, mandal, district: district || 'Chittoor', pincode: pincode || '517425', state: state || 'Andhra Pradesh',
    username, password, is_first_login: true,
    created_at: new Date().toISOString()
  };
  mockDB.officers.push(newOfficer);
  await logActivity('OFFICER_ONBOARDED', `Field Officer onboarded: ${name} (${village}, ${mandal})`, 'ADMIN');
  return newOfficer;
}

async function authenticateOfficer(username, password) {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from('officers')
      .select('*, departments(name)')
      .eq('username', username)
      .eq('password', password)
      .single();
    if (!error && data) return data;
  }
  const officer = mockDB.officers.find(o => o.username === username && o.password === password);
  if (officer) {
    const dept = mockDB.departments.find(d => d.id === officer.department_id);
    return { ...officer, departments: dept || { name: 'Unknown' } };
  }
  return null;
}

async function setupOfficerPassword(username, newPassword) {
  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from('officers')
      .update({ password: newPassword, is_first_login: false })
      .eq('username', username)
      .select();
    if (!error && data) return data[0];
  }
  const officer = mockDB.officers.find(o => o.username === username);
  if (officer) {
    officer.password = newPassword;
    officer.is_first_login = false;
    await logActivity('OFFICER_PASSWORD_SETUP', `Officer ${username} created permanent credentials`, 'OFFICER', officer.id);
    return officer;
  }
  throw new Error('Officer not found.');
}

async function deleteDepartment(id) {
  const deptId = parseInt(id);
  if (!isMockMode && supabase) {
    const { error } = await supabase.from('departments').delete().eq('id', deptId);
    if (error) throw error;
    await logActivity('DEPARTMENT_DELETED', `Department #${deptId} deleted`, 'ADMIN');
    return true;
  }
  const idx = mockDB.departments.findIndex(d => d.id === deptId);
  if (idx !== -1) mockDB.departments.splice(idx, 1);
  await logActivity('DEPARTMENT_DELETED', `Department #${deptId} deleted`, 'ADMIN');
  return true;
}

async function deleteOfficer(id) {
  const offId = parseInt(id);
  if (!isMockMode && supabase) {
    const { error } = await supabase.from('officers').delete().eq('id', offId);
    if (error) throw error;
    await logActivity('OFFICER_DELETED', `Officer #${offId} deleted`, 'ADMIN');
    return true;
  }
  const idx = mockDB.officers.findIndex(o => o.id === offId);
  if (idx !== -1) mockDB.officers.splice(idx, 1);
  await logActivity('OFFICER_DELETED', `Officer #${offId} deleted`, 'ADMIN');
  return true;
}

async function findOfficerForComplaint(village, mandal, category_id) {
  const catId = parseInt(category_id);
  const cleanVillage = cleanLocationName(village);
  const cleanMandal = cleanLocationName(mandal);

  if (!isMockMode && supabase) {
    // 1. Exact Village + Mandal + Department Match
    const { data: villageMatch } = await supabase
      .from('officers')
      .select('*')
      .ilike('village', cleanVillage)
      .ilike('mandal', cleanMandal)
      .eq('department_id', catId)
      .maybeSingle();
    if (villageMatch) return villageMatch;

    // 2. Mandal Match + Department
    const { data: mandalMatch } = await supabase
      .from('officers')
      .select('*')
      .ilike('mandal', cleanMandal)
      .eq('department_id', catId)
      .maybeSingle();
    if (mandalMatch) return mandalMatch;

    // 3. Department Match anywhere in database (Same department ONLY!)
    const { data: deptOfficers } = await supabase
      .from('officers')
      .select('*')
      .eq('department_id', catId)
      .order('id', { ascending: false });
    if (deptOfficers && deptOfficers.length > 0) return deptOfficers[0];

    // STRICT: Return null if no officer exists for this department! Do NOT fall back to another department's officer!
    return null;
  }

  // Mock Mode Strict Matching
  let match = mockDB.officers.find(o => 
    o.village.toLowerCase() === cleanVillage.toLowerCase() &&
    o.mandal.toLowerCase() === cleanMandal.toLowerCase() &&
    parseInt(o.department_id) === catId
  );

  if (!match) {
    match = mockDB.officers.find(o => 
      o.mandal.toLowerCase() === cleanMandal.toLowerCase() &&
      parseInt(o.department_id) === catId
    );
  }

  if (!match) {
    match = mockDB.officers.find(o => parseInt(o.department_id) === catId);
  }

  return match || null;
}

// --- COMPLAINTS ---
async function createComplaint(complaintData) {
  const trackingId = generateNumericTrackingId();
  const fullPayload = {
    tracking_id: trackingId,
    status: 'PENDING',
    created_at: new Date().toISOString(),
    ...complaintData
  };

  if (!isMockMode && supabase) {
    const dbPayload = {
      tracking_id: fullPayload.tracking_id,
      citizen_mobile: fullPayload.citizen_mobile,
      original_note: fullPayload.original_note,
      detected_language: fullPayload.detected_language,
      latitude: fullPayload.latitude,
      longitude: fullPayload.longitude,
      state: fullPayload.state,
      district: fullPayload.district,
      mandal: fullPayload.mandal,
      village: fullPayload.village,
      category_id: fullPayload.category_id ? parseInt(fullPayload.category_id) : null,
      severity: fullPayload.severity,
      ai_summary: fullPayload.ai_summary,
      pdf_path: fullPayload.pdf_path,
      status: fullPayload.status,
      created_at: fullPayload.created_at
    };

    const { data, error } = await supabase.from('complaints').insert([dbPayload]).select('*, departments(name)');
    if (error) {
      console.error('❌ Supabase insert complaint error:', error.message);
    } else if (data && data.length > 0) {
      await logActivity('COMPLAINT_SUBMITTED', `Grievance submitted with Tracking ID #${trackingId}`, 'CITIZEN', null, data[0].id);
      return {
        ...data[0],
        category_name: complaintData.category_name || (data[0].departments ? data[0].departments.name : 'Public Works')
      };
    }
  }

  const newComplaint = { id: nextComplaintId++, ...fullPayload };
  mockDB.complaints.unshift(newComplaint);
  await logActivity('COMPLAINT_SUBMITTED', `Grievance submitted with Tracking ID #${trackingId}`, 'CITIZEN', null, newComplaint.id);
  return newComplaint;
}

async function getComplaints(filter = {}) {
  if (!isMockMode && supabase) {
    let query = supabase.from('complaints').select('*, departments(name)').order('id', { ascending: false });
    
    if (filter.category_id) {
      query = query.eq('category_id', parseInt(filter.category_id));
    } else {
      if (filter.village) query = query.ilike('village', filter.village.trim());
      if (filter.mandal) query = query.ilike('mandal', filter.mandal.trim());
    }

    const { data, error } = await query;
    if (!error && data) {
      return data.map(c => checkAndUpdateOverdueStatus(c));
    }
  }

  let list = [...mockDB.complaints];
  if (filter.category_id) {
    list = list.filter(c => parseInt(c.category_id) === parseInt(filter.category_id));
  } else {
    if (filter.village) {
      list = list.filter(c => c.village.toLowerCase() === filter.village.toLowerCase());
    }
    if (filter.mandal) {
      list = list.filter(c => c.mandal.toLowerCase() === filter.mandal.toLowerCase());
    }
  }
  return list.map(c => {
    checkAndUpdateOverdueStatus(c);
    return {
      ...c,
      departments: mockDB.departments.find(d => d.id === parseInt(c.category_id)) || { name: 'General' }
    };
  });
}

async function getComplaintByTrackingId(trackingId) {
  const rawStr = String(trackingId || '').replace('#', '').trim();
  const numericId = parseInt(rawStr, 10);

  if (!isMockMode && supabase) {
    let query = supabase.from('complaints').select('*, departments(name)');

    if (!isNaN(numericId)) {
      query = query.or(`tracking_id.eq.${numericId},id.eq.${numericId},citizen_mobile.ilike.%${rawStr}%`);
    } else {
      query = query.or(`citizen_mobile.ilike.%${rawStr}%`);
    }

    const { data, error } = await query.order('id', { ascending: false }).limit(1).maybeSingle();
    if (!error && data) {
      const updated = checkAndUpdateOverdueStatus(data);
      const updates = await getComplaintUpdates(updated.id);
      return { ...updated, updates };
    }
  }

  const c = mockDB.complaints.find(comp => 
    (numericId && (parseInt(comp.tracking_id) === numericId || parseInt(comp.id) === numericId)) ||
    (comp.citizen_mobile && comp.citizen_mobile.includes(rawStr))
  );
  if (!c) return null;

  checkAndUpdateOverdueStatus(c);
  const updates = mockDB.complaint_updates.filter(u => parseInt(u.complaint_id) === parseInt(c.id));
  return {
    ...c,
    departments: mockDB.departments.find(d => d.id === parseInt(c.category_id)) || { name: 'General' },
    updates
  };
}

async function acceptComplaint(id, officerId, deadlineHours = 24, customDeadlineIso = null) {
  const acceptedAt = new Date().toISOString();
  let deadlineAt;
  if (customDeadlineIso) {
    deadlineAt = new Date(customDeadlineIso).toISOString();
  } else {
    const hours = parseFloat(deadlineHours) || 24;
    deadlineAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
  }
  const status = 'ONGOING';

  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from('complaints')
      .update({ status, accepted_at: acceptedAt, deadline_at: deadlineAt })
      .eq('id', id)
      .select();
    if (!error && data) {
      await logActivity('COMPLAINT_ACCEPTED', `Officer accepted complaint #${id} with target deadline ${deadlineAt}`, 'OFFICER', officerId, id);
      return data[0];
    }
  }

  const complaint = mockDB.complaints.find(c => parseInt(c.id) === parseInt(id));
  if (complaint) {
    complaint.status = status;
    complaint.accepted_at = acceptedAt;
    complaint.deadline_at = deadlineAt;
    await logActivity('COMPLAINT_ACCEPTED', `Officer accepted complaint #${id} with target deadline ${deadlineAt}`, 'OFFICER', officerId, id);
    return complaint;
  }
  throw new Error('Complaint not found.');
}

async function addComplaintUpdate(complaintId, officerId, originalUpdate, translatedUpdate, targetLanguage = 'Telugu', newStatus = 'ONGOING') {
  const updateObj = {
    id: nextUpdateId++,
    complaint_id: parseInt(complaintId),
    officer_id: officerId ? parseInt(officerId) : null,
    original_update: originalUpdate,
    translated_update: translatedUpdate,
    target_language: targetLanguage,
    status_change: newStatus,
    created_at: new Date().toISOString()
  };

  if (!isMockMode && supabase) {
    await supabase.from('complaint_updates').insert([updateObj]);
    if (newStatus) {
      await supabase.from('complaints').update({ status: newStatus }).eq('id', complaintId);
    }
  }

  mockDB.complaint_updates.push(updateObj);
  const complaint = mockDB.complaints.find(c => parseInt(c.id) === parseInt(complaintId));
  if (complaint && newStatus) {
    complaint.status = newStatus;
  }

  await logActivity('PROGRESS_UPDATE_ADDED', `Officer update added to complaint #${complaintId}: ${originalUpdate}`, 'OFFICER', officerId, complaintId);
  return updateObj;
}

async function resolveComplaint(id, officerId) {
  const resolvedAt = new Date().toISOString();
  const status = 'RESOLVED';

  if (!isMockMode && supabase) {
    const { data, error } = await supabase
      .from('complaints')
      .update({ status, resolved_at: resolvedAt })
      .eq('id', id)
      .select();
    if (!error && data) {
      await logActivity('COMPLAINT_RESOLVED', `Complaint #${id} marked RESOLVED`, 'OFFICER', officerId, id);
      return data[0];
    }
  }

  const complaint = mockDB.complaints.find(c => parseInt(c.id) === parseInt(id));
  if (complaint) {
    complaint.status = status;
    complaint.resolved_at = resolvedAt;
    await logActivity('COMPLAINT_RESOLVED', `Complaint #${id} marked RESOLVED`, 'OFFICER', officerId, id);
    return complaint;
  }
  throw new Error('Complaint not found.');
}

async function getComplaintUpdates(complaintId) {
  if (!isMockMode && supabase) {
    const { data } = await supabase.from('complaint_updates').select('*').eq('complaint_id', complaintId).order('id', { ascending: true });
    if (data) return data;
  }
  return mockDB.complaint_updates.filter(u => parseInt(u.complaint_id) === parseInt(complaintId));
}

async function getActivityLogs() {
  if (!isMockMode && supabase) {
    const { data } = await supabase.from('activity_logs').select('*').order('id', { ascending: false }).limit(50);
    if (data) return data;
  }
  return mockDB.activity_logs;
}

async function getAdminAnalytics() {
  const complaints = await getComplaints();
  const total = complaints.length;
  const pending = complaints.filter(c => c.status === 'PENDING').length;
  const ongoing = complaints.filter(c => c.status === 'ONGOING' || c.status === 'DISPATCHED').length;
  const resolved = complaints.filter(c => c.status === 'RESOLVED').length;
  const overdue = complaints.filter(c => c.status === 'OVERDUE').length;
  const emergency = complaints.filter(c => c.severity === 'EMERGENCY').length;

  return {
    total,
    pending,
    ongoing,
    resolved,
    overdue,
    emergency,
    onTimeComplianceRate: resolved > 0 ? Math.round(((resolved - overdue) / resolved) * 100) : 100
  };
}

module.exports = {
  getDepartments,
  addDepartment,
  deleteDepartment,
  getOfficers,
  addOfficer,
  deleteOfficer,
  authenticateOfficer,
  setupOfficerPassword,
  findOfficerForComplaint,
  createComplaint,
  getComplaints,
  getComplaintByTrackingId,
  acceptComplaint,
  addComplaintUpdate,
  resolveComplaint,
  getActivityLogs,
  getAdminAnalytics
};
