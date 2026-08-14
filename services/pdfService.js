const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates an Official Government Incident Letter PDF Report (Dynamic Text Flow - Zero Overlap)
 */
function generateIncidentPDF(complaint) {
  return new Promise((resolve, reject) => {
    try {
      const reportsDir = path.join(__dirname, '..', 'public', 'reports');
      if (!fs.existsSync(reportsDir)) {
        fs.mkdirSync(reportsDir, { recursive: true });
      }

      const trackingId = complaint.tracking_id || complaint.id;
      const fileName = `incident_report_${trackingId}_${Date.now()}.pdf`;
      const filePath = path.join(reportsDir, fileName);
      const relativePath = `/reports/${fileName}`;

      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const writeStream = fs.createWriteStream(filePath);
      doc.pipe(writeStream);

      // Clean non-Latin symbols for PDFKit Helvetica font rendering
      const cleanSummary = (complaint.ai_summary || '').replace(/[^\x00-\x7F]/g, '').trim() || 'Immediate inspection and field action required.';
      const cleanEnglishTrans = (complaint.english_translation || complaint.ai_summary || complaint.original_note || '').replace(/[^\x00-\x7F]/g, '').trim() || 'Grievance reported by citizen. Action requested.';
      
      // Clean original note for PDF rendering to avoid Helvetica encoding corruptions
      let cleanOriginalNote = (complaint.original_note || '').replace(/[^\x00-\x7F]/g, '').trim();
      if (!cleanOriginalNote || cleanOriginalNote.length < 3) {
        cleanOriginalNote = `[Voice/Native Script Note in ${complaint.detected_language || 'Native Script'} - Translated below]`;
      }

      // --- Header Banner (Official Government Navy Blue) ---
      doc.rect(40, 40, 515, 65).fill('#0F3D3E');
      doc.fillColor('#FFFFFF')
         .fontSize(16)
         .font('Helvetica-Bold')
         .text('GOVERNMENT OF ANDHRA PRADESH / CIVICAI', 50, 48, { align: 'center' });
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .text('OFFICIAL PUBLIC GRIEVANCE & INCIDENT DISPATCH LETTER', 50, 68, { align: 'center' });
      doc.fontSize(9)
         .font('Helvetica')
         .text('Governed under District Public Redressal Mechanism & e-Panchayat Portal', 50, 84, { align: 'center' });

      // --- Letter Metadata Block ---
      const topY = 125;
      doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold');

      doc.text(`REF NO / TRACKING ID: #${trackingId}`, 40, topY);
      doc.text(`DATE & TIME: ${new Date(complaint.created_at || Date.now()).toLocaleString('en-IN')}`, 320, topY);

      // Severity Badge Box
      const sevUpper = (complaint.severity || 'MILD').toUpperCase();

      doc.rect(40, topY + 18, 515, 2).fill('#CBD5E1');

      // --- Formal Letter To/From Block ---
      const letterHeaderY = topY + 28;
      doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
      doc.text('FROM:', 40, letterHeaderY);
      doc.font('Helvetica').fillColor('#0F172A').text('Public Grievance Redressal Cell, District Administration', 90, letterHeaderY);

      doc.font('Helvetica-Bold').fillColor('#334155').text('TO:', 40, letterHeaderY + 16);
      doc.font('Helvetica').fillColor('#0F172A').text(`Designated Field Officer (${complaint.category_name || 'Public Works'})`, 90, letterHeaderY + 16);

      doc.font('Helvetica-Bold').fillColor('#334155').text('LOCATION:', 40, letterHeaderY + 32);
      doc.font('Helvetica').fillColor('#0F172A').text(`${complaint.village}, ${complaint.mandal} Mandal, ${complaint.district || 'Chittoor'} District`, 90, letterHeaderY + 32);

      // Formal Subject Line
      const subjY = letterHeaderY + 52;
      doc.rect(40, subjY, 515, 24).fill('#F1F5F9').stroke('#E2E8F0');
      doc.fillColor('#0F3D3E').fontSize(9.5).font('Helvetica-Bold')
         .text(`SUBJECT: Official Action Directive for ${complaint.category_name || 'Grievance'} Issue (Priority: ${sevUpper})`, 50, subjY + 7);

      // --- DYNAMIC Y COORDINATE CALCULATOR (PREVENTS ANY TEXT OVERLAP) ---
      let currentY = subjY + 32;

      // --- Section 1: MANDATORY OFFICIAL ENGLISH TRANSLATION ---
      const sec1Title = '1. OFFICIAL ENGLISH TRANSLATION OF CITIZEN GRIEVANCE LETTER:';
      const sec1Text = `"${cleanEnglishTrans}"`;
      doc.font('Helvetica').fontSize(9);
      const sec1TextHeight = doc.heightOfString(sec1Text, { width: 495, leading: 1.35 });
      const sec1BoxHeight = Math.max(45, sec1TextHeight + 28);

      doc.rect(40, currentY, 515, sec1BoxHeight).fill('#FFFFFF').stroke('#0F3D3E');
      doc.fillColor('#0F3D3E').fontSize(9.5).font('Helvetica-Bold').text(sec1Title, 50, currentY + 7);
      doc.fillColor('#1E293B').fontSize(9).font('Helvetica').text(sec1Text, 50, currentY + 22, { width: 495, leading: 1.35 });

      currentY += sec1BoxHeight + 10;

      // --- Section 2: CITIZEN ORIGINAL TRANSCRIPT (NATIVE SCRIPT) ---
      const sec2Title = `2. CITIZEN ORIGINAL VOICE / TEXT TRANSCRIPT (${complaint.detected_language || 'Native'}):`;
      const sec2Text = `"${cleanOriginalNote}"`;
      doc.font('Helvetica-Oblique').fontSize(8.5);
      const sec2TextHeight = doc.heightOfString(sec2Text, { width: 495 });
      const sec2BoxHeight = Math.max(38, sec2TextHeight + 26);

      doc.rect(40, currentY, 515, sec2BoxHeight).fill('#F8FAFC').stroke('#E2E8F0');
      doc.fillColor('#475569').fontSize(9.5).font('Helvetica-Bold').text(sec2Title, 50, currentY + 7);
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica-Oblique').text(sec2Text, 50, currentY + 22, { width: 495 });

      currentY += sec2BoxHeight + 10;

      // --- Section 3: AI BRIEF PROBLEM ANALYSIS & EXECUTIVE FIELD DIRECTIVE ---
      const sec3Title = '3. AI BRIEF PROBLEM ANALYSIS & EXECUTIVE FIELD DIRECTIVE:';
      const detailedAnalysis = `ANALYZED ISSUE: "${cleanEnglishTrans}"\nDEPARTMENT ALLOCATION: ${complaint.category_name || 'Public Infrastructure'} (Severity: ${sevUpper})\nEXECUTIVE ACTION DIRECTIVE: ${cleanSummary || 'Immediate field inspection, emergency repair crew dispatch, and status update required.'}`;

      doc.font('Helvetica').fontSize(8.5);
      const sec3TextHeight = doc.heightOfString(detailedAnalysis, { width: 495, leading: 1.3 });
      const sec3BoxHeight = Math.max(50, sec3TextHeight + 28);

      doc.rect(40, currentY, 515, sec3BoxHeight).fill('#EFF6FF').stroke('#BFDBFE');
      doc.fillColor('#1E40AF').fontSize(9.5).font('Helvetica-Bold').text(sec3Title, 50, currentY + 7);
      doc.fillColor('#1E293B').fontSize(8.5).font('Helvetica').text(detailedAnalysis, 50, currentY + 22, { width: 495, leading: 1.3 });

      currentY += sec3BoxHeight + 14;

      // --- Section 4: GPS LOCATION & FIELD METRICS ---
      const mapsUrl = `https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`;
      doc.fillColor('#0F3D3E').fontSize(9.5).font('Helvetica-Bold').text('4. GPS LOCATION & CONTACT DETAILS:', 40, currentY);
      doc.fillColor('#334155').fontSize(8.5).font('Helvetica')
         .text(`Citizen Mobile: +91 ${complaint.citizen_mobile}  |  GPS Coordinates: ${complaint.latitude}, ${complaint.longitude}`, 40, currentY + 14);
      doc.fillColor('#2563EB').fontSize(8.5).font('Helvetica-Bold').text(`Google Maps Field Navigation: ${mapsUrl}`, 40, currentY + 26, { link: mapsUrl, underline: true });

      // --- Official Signature & Stamp Box (Fixed at bottom of page) ---
      const stampY = 705;
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, stampY).lineTo(555, stampY).stroke();

      doc.rect(380, stampY + 8, 175, 52).stroke('#CBD5E1');
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
         .text('OFFICIAL DIGITAL STAMP & SIGNATURE', 385, stampY + 13, { width: 165, align: 'center' });
      doc.fillColor('#0F3D3E').fontSize(8.5).font('Helvetica-Bold')
         .text('CivicAI Automated Dispatch', 385, stampY + 27, { width: 165, align: 'center' });
      doc.fontSize(7).font('Helvetica')
         .text('Verified under e-Governance IT Act', 385, stampY + 40, { width: 165, align: 'center' });

      doc.fillColor('#64748B').fontSize(7.5).font('Helvetica')
         .text('This is an official government incident report generated by CivicAI. Electronically verified.', 40, stampY + 20);
      doc.text('CivicAI Public Grievance Redressal Platform', 40, stampY + 32);

      doc.end();

      writeStream.on('finish', () => {
        resolve(relativePath);
      });

      writeStream.on('error', (err) => {
        reject(err);
      });

    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generateIncidentPDF
};
