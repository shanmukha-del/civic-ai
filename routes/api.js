const express = require('express');
const router = express.Router();

const fs = require('fs');
const path = require('path');
const db = require('../services/supabaseService');
const { analyzeGrievance, translateOfficerUpdate } = require('../services/geminiService');
const { generateIncidentPDF } = require('../services/pdfService');
const { sendOfficerOnboardingEmail } = require('../services/emailService');
const twilioService = require('../services/twilioService');

// --- DYNAMIC PDF DOWNLOAD ENDPOINT ---
router.get('/complaints/download-pdf/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const complaint = await db.getComplaintByTrackingId(trackingId);
    if (!complaint) {
      return res.status(404).send('Complaint not found');
    }

    let pdfPathRelative = complaint.pdf_path;
    let fullPath = pdfPathRelative ? path.join(__dirname, '..', 'public', pdfPathRelative) : null;

    if (!fullPath || !fs.existsSync(fullPath)) {
      pdfPathRelative = await generateIncidentPDF(complaint);
      fullPath = path.join(__dirname, '..', 'public', pdfPathRelative);
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="incident_report_${trackingId}.pdf"`);
    res.sendFile(fullPath);
  } catch (err) {
    console.error('Error generating/downloading PDF:', err);
    res.status(500).send('Error generating PDF report');
  }
});

// --- 1. DEPARTMENTS ---
router.get('/departments', async (req, res) => {
  try {
    const depts = await db.getDepartments();
    res.json({ success: true, departments: depts });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/departments', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ success: false, error: 'Department name is required.' });
    }
    const newDept = await db.addDepartment(name.trim());
    res.json({ success: true, department: newDept });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.delete('/departments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteDepartment(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- 2. OFFICERS ---
router.get('/officers', async (req, res) => {
  try {
    const officers = await db.getOfficers();
    res.json({ success: true, officers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.delete('/officers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteOfficer(id);
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/officers', async (req, res) => {
  try {
    const { name, mobile, email, department_id, village, mandal, district, pincode, state, username, password } = req.body;
    if (!name || !mobile || !department_id || !village || !mandal || !username || !password) {
      return res.status(400).json({ success: false, error: 'All mandatory officer fields are required.' });
    }

    const newOfficer = await db.addOfficer({
      name: name.trim(),
      mobile: mobile.trim(),
      email: email ? email.trim() : `${username.trim()}@civicai.gov.in`,
      department_id: parseInt(department_id),
      village: village.trim(),
      mandal: mandal.trim(),
      district: district ? district.trim() : 'Chittoor',
      pincode: pincode ? pincode.trim() : '517425',
      state: state ? state.trim() : 'Andhra Pradesh',
      username: username.trim(),
      password: password.trim()
    });

    const depts = await db.getDepartments();
    const deptObj = depts.find(d => d.id === parseInt(department_id));

    // Dispatch Onboarding Email
    await sendOfficerOnboardingEmail({
      name: newOfficer.name,
      email: newOfficer.email,
      username: newOfficer.username,
      password: newOfficer.password,
      departmentName: deptObj ? deptObj.name : 'Public Department',
      village: newOfficer.village,
      mandal: newOfficer.mandal,
      district: newOfficer.district
    });

    res.json({ success: true, officer: newOfficer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/officers/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ success: false, error: 'Username and Password required.' });
    }

    const officer = await db.authenticateOfficer(username.trim(), password.trim());
    if (!officer) {
      return res.status(401).json({ success: false, error: 'Invalid officer credentials.' });
    }

    res.json({ success: true, officer });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/officers/setup-password', async (req, res) => {
  try {
    const { username, newPassword } = req.body;
    if (!username || !newPassword || newPassword.length < 4) {
      return res.status(400).json({ success: false, error: 'Please enter a valid password (min 4 characters).' });
    }

    const updatedOfficer = await db.setupOfficerPassword(username.trim(), newPassword.trim());
    res.json({ success: true, officer: updatedOfficer });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

function cleanLocationString(str) {
  if (!str) return 'Chittoor';
  let s = String(str);
  if (/[\u0900-\u097F]/.test(s) || s.includes('चित्तूर') || s.includes('??')) {
    return 'Chittoor';
  }
  const cleaned = s.replace(/[^\x00-\x7F]/g, '').trim();
  return cleaned || 'Chittoor';
}

// --- 3. DYNAMIC AI SPEECH PHRASING ---
router.post('/gemini/confirm-speech', async (req, res) => {
  try {
    const { original_note, village, mandal, user_language } = req.body;
    if (!original_note) {
      return res.status(400).json({ success: false, error: 'Original note is required.' });
    }

    const cleanVill = cleanLocationString(village);
    const cleanMand = cleanLocationString(mandal);

    const availableDepts = await db.getDepartments();
    const analysis = await analyzeGrievance(original_note, cleanVill, cleanMand, availableDepts, user_language);

    res.json({
      success: true,
      detected_language: analysis.detected_language,
      bcp47_code: analysis.bcp47_code,
      confirmation_speech: analysis.confirmation_speech
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 4. COMPLAINTS SUBMISSION & DISPATCH ---
router.post('/complaints', async (req, res) => {
  try {
    const { citizen_mobile, original_note, latitude, longitude, state, district, village, mandal, user_language } = req.body;

    if (!citizen_mobile || !original_note || !latitude || !longitude || !village || !mandal) {
      return res.status(400).json({ success: false, error: 'Missing mandatory complaint fields.' });
    }

    const cleanVill = cleanLocationString(village);
    const cleanMand = cleanLocationString(mandal);
    const cleanDist = cleanLocationString(district);

    const availableDepts = await db.getDepartments();

    // 1. AI Analysis
    const aiAnalysis = await analyzeGrievance(original_note, cleanVill, cleanMand, availableDepts, user_language);

    // 2. Find Assigned Officers for all matched departments
    const matchedDepts = aiAnalysis.matched_departments || [{ id: aiAnalysis.category_id, name: aiAnalysis.category_name }];
    const assignedOfficers = [];

    for (const dept of matchedDepts) {
      const off = await db.findOfficerForComplaint(cleanVill, cleanMand, dept.id);
      assignedOfficers.push({
        department_id: dept.id,
        department_name: dept.name,
        officer_name: off ? off.name : 'Central Admin Cell',
        officer_mobile: off ? off.mobile : '',
        is_assigned: !!off
      });
    }

    const primaryOfficer = assignedOfficers[0];
    const officerMobile = primaryOfficer ? primaryOfficer.officer_mobile : '';
    const officerName = primaryOfficer ? primaryOfficer.officer_name : 'Central Admin Cell';

    let finalSummary = aiAnalysis.ai_summary;
    if (aiAnalysis.is_multi_department) {
      const deptListStr = matchedDepts.map(d => d.name).join(' & ');
      const offListStr = assignedOfficers.map(o => `${o.officer_name} (${o.department_name})`).join(', ');
      finalSummary = `🎯 MULTI-DEPARTMENT DISPATCH (${matchedDepts.length} Sectors: ${deptListStr}). Assigned Officers: ${offListStr}. ${aiAnalysis.ai_summary}`;
    }

    // 3. Save Complaint with 8-digit Tracking ID
    const complaintData = {
      citizen_mobile: citizen_mobile.trim(),
      original_note: original_note.trim(),
      detected_language: aiAnalysis.detected_language,
      latitude: parseFloat(latitude),
      longitude: parseFloat(longitude),
      state: state || 'Andhra Pradesh',
      district: cleanDist,
      village: cleanVill,
      mandal: cleanMand,
      category_id: aiAnalysis.category_id,
      category_name: aiAnalysis.is_multi_department ? aiAnalysis.multi_department_names : aiAnalysis.category_name,
      severity: aiAnalysis.severity,
      ai_summary: finalSummary,
      status: 'PENDING'
    };

    const createdComplaint = await db.createComplaint(complaintData);

    // Save secondary complaints for secondary officers so they also see it on their Officer Dashboard!
    if (aiAnalysis.is_multi_department && matchedDepts.length > 1) {
      for (let i = 1; i < matchedDepts.length; i++) {
        const secDept = matchedDepts[i];
        const subData = {
          ...complaintData,
          category_id: secDept.id,
          category_name: secDept.name,
          ai_summary: `[LINKED MULTI-DEPT TICKET #${createdComplaint.tracking_id}] ${finalSummary}`
        };
        try {
          await db.createComplaint(subData);
        } catch (subErr) {
          console.warn('Sub-complaint dispatch note:', subErr.message);
        }
      }
    }

    // 4. Generate PDF Report
    let pdfPath = '';
    try {
      pdfPath = await generateIncidentPDF(createdComplaint);
      createdComplaint.pdf_path = pdfPath;
    } catch (pdfErr) {
      console.error('PDF Generation warning:', pdfErr.message);
    }

    // 5. Build Direct WhatsApp Routing Link
    const mapLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
    const whatsappMessage = 
      `CIVIC EMERGENCY ALERT\n\n` +
      `Tracking ID: #${createdComplaint.tracking_id}\n` +
      `Category: ${createdComplaint.category_name}\n` +
      `Severity: ${aiAnalysis.severity}\n` +
      `Citizen Mobile: ${citizen_mobile}\n` +
      `Location: ${village}, ${mandal}\n` +
      `Language: ${aiAnalysis.detected_language}\n` +
      `Summary: ${aiAnalysis.ai_summary}\n\n` +
      `Map Link: ${mapLink}`;

    const whatsappURL = `https://api.whatsapp.com/send?phone=91${officerMobile}&text=${encodeURIComponent(whatsappMessage)}`;

      village: cleanVill,
      mandal: cleanMand
    });

    // Twilio disabled as requested
    // Twilio disabled as requested

    // Also Alert Assigned Officer via Twilio SMS & WhatsApp
    const officerMsg = `CIVICAI INCIDENT ASSIGNED #${createdComplaint.tracking_id}\nCategory: ${aiAnalysis.category_name}\nSeverity: ${aiAnalysis.severity}\nLocation: ${cleanVill}, ${cleanMand}\nCitizen Mobile: ${citizen_mobile}\nNote: "${original_note}"\nMap: ${mapLink}`;
    // Twilio disabled as requested
    // Twilio disabled as requested

    res.json({
      success: true,
      complaint: createdComplaint,
      tracking_id: createdComplaint.tracking_id,
      assigned_officer: {
        name: officerName,
        mobile: officerMobile,
        is_assigned: !!officer
      },
      whatsapp_url: whatsappURL,
      pdf_path: pdfPath
    });

  } catch (err) {
    console.error('Error submitting complaint:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 5. COMPLAINTS LISTING & TRACKING ---
router.get('/complaints', async (req, res) => {
  try {
    const { village, mandal, category_id } = req.query;
    const complaints = await db.getComplaints({ village, mandal, category_id });
    res.json({ success: true, complaints });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/complaints/track/:trackingId', async (req, res) => {
  try {
    const { trackingId } = req.params;
    const complaint = await db.getComplaintByTrackingId(trackingId);

    if (!complaint) {
      return res.status(404).json({ success: false, error: 'Tracking ID not found.' });
    }

    res.json({ success: true, complaint });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 6. OFFICER ACTIONS ---
router.post('/complaints/:id/accept', async (req, res) => {
  try {
    const { id } = req.params;
    const { officer_id, deadline_hours, custom_deadline_datetime } = req.body;

    const accepted = await db.acceptComplaint(id, officer_id, deadline_hours, custom_deadline_datetime);

    // Dispatch Real Twilio SMS & WhatsApp Accept Notification to Citizen
    try {
      const complaint = await db.getComplaintByTrackingId(id);
      if (complaint && complaint.citizen_mobile) {
        let deadlineStr = 'Within 24 Hours';
        if (custom_deadline_datetime) {
          deadlineStr = new Date(custom_deadline_datetime).toLocaleString();
        } else if (deadline_hours) {
          deadlineStr = `Within ${deadline_hours} Hours`;
        }

        let officerName = 'Field Officer';
        let officerMobile = '';
        if (officer_id) {
          const officers = await db.getOfficers();
          const off = officers.find(o => parseInt(o.id) === parseInt(officer_id));
          if (off) {
            officerName = off.name;
            officerMobile = off.mobile;
          }
        }

        const acceptMsg = twilioService.buildMultilingualNotification('ACCEPTED', complaint.detected_language, {
          tracking_id: complaint.tracking_id,
          officer_name: officerName,
          officer_mobile: officerMobile,
          deadline_str: deadlineStr
        });

        // Twilio disabled as requested
        // Twilio disabled as requested
      }
    } catch (e) {
      console.warn('Accept Twilio Notification warning:', e.message);
    }

    res.json({ success: true, complaint: accepted });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

router.post('/complaints/:id/update', async (req, res) => {
  try {
    const { id } = req.params;
    const { officer_id, update_text, target_language } = req.body;

    if (!update_text || !update_text.trim()) {
      return res.status(400).json({ success: false, error: 'Update text is required.' });
    }

    const targetLang = target_language || 'Telugu';

    // Gemini Translation
    const translatedUpdate = await translateOfficerUpdate(update_text.trim(), targetLang);

    const updateObj = await db.addComplaintUpdate(id, officer_id, update_text.trim(), translatedUpdate, targetLang, 'ONGOING');

    let whatsappUrl = '';
    let citizenMobile = '';

    // Dispatch Real Twilio SMS & WhatsApp Progress Update to Citizen
    try {
      const complaint = await db.getComplaintByTrackingId(id);
      if (complaint && complaint.citizen_mobile) {
        citizenMobile = complaint.citizen_mobile;

        let officerName = 'Field Officer';
        if (officer_id) {
          const officers = await db.getOfficers();
          const off = officers.find(o => parseInt(o.id) === parseInt(officer_id));
          if (off) officerName = off.name;
        }

        const updateMsg = twilioService.buildMultilingualNotification('UPDATED', complaint.detected_language || targetLang, {
          tracking_id: complaint.tracking_id,
          officer_name: officerName,
          update_text: translatedUpdate
        });

        // Twilio disabled as requested
        // Twilio disabled as requested

        whatsappUrl = `https://api.whatsapp.com/send?phone=91${citizenMobile}&text=${encodeURIComponent(updateMsg)}`;
      }
    } catch (e) {}

    res.json({
      success: true,
      update: updateObj,
      translated_text: translatedUpdate,
      citizen_mobile: citizenMobile,
      whatsapp_url: whatsappUrl
    });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.post('/complaints/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { officer_id } = req.body;

    const resolved = await db.resolveComplaint(id, officer_id);

    // Dispatch Real Twilio SMS & WhatsApp Resolution Notification to Citizen
    try {
      const complaint = await db.getComplaintByTrackingId(id);
      if (complaint && complaint.citizen_mobile) {
        let officerName = 'Field Officer';
        if (officer_id) {
          const officers = await db.getOfficers();
          const off = officers.find(o => parseInt(o.id) === parseInt(officer_id));
          if (off) officerName = off.name;
        }

        const resolveMsg = twilioService.buildMultilingualNotification('RESOLVED', complaint.detected_language, {
          tracking_id: complaint.tracking_id,
          officer_name: officerName
        });

        // Twilio disabled as requested
        // Twilio disabled as requested
      }
    } catch (e) {}

    res.json({ success: true, complaint: resolved });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

// --- 7. ADMIN ANALYTICS & AUDIT LOGS ---
router.get('/admin/analytics', async (req, res) => {
  try {
    const analytics = await db.getAdminAnalytics();
    res.json({ success: true, analytics });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

router.get('/admin/logs', async (req, res) => {
  try {
    const logs = await db.getActivityLogs();
    res.json({ success: true, logs });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
