const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

/**
 * Generates an Official Government Incident Letter PDF Report (Zero Emoji, Clean Format)
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

      doc.moveDown(3);

      // --- Letter Metadata Block ---
      const topY = 125;
      doc.fillColor('#1E293B').fontSize(10).font('Helvetica-Bold');

      doc.text(`REF NO / TRACKING ID: #${trackingId}`, 40, topY);
      doc.text(`DATE & TIME: ${new Date(complaint.created_at || Date.now()).toLocaleString('en-IN')}`, 320, topY);

      // Severity Badge Box
      let severityColor = '#059669'; // Green (MILD)
      const sevUpper = (complaint.severity || 'MILD').toUpperCase();
      if (sevUpper === 'EMERGENCY') severityColor = '#DC2626'; // Red
      if (sevUpper === 'MODERATE') severityColor = '#D97706'; // Amber

      doc.rect(40, topY + 18, 515, 2).fill('#CBD5E1');

      // --- Formal Letter To/From Block ---
      const letterHeaderY = topY + 30;
      doc.fillColor('#334155').fontSize(10).font('Helvetica-Bold');
      doc.text('FROM:', 40, letterHeaderY);
      doc.font('Helvetica').fillColor('#0F172A').text('Public Grievance Redressal Cell, District Administration', 90, letterHeaderY);

      doc.font('Helvetica-Bold').fillColor('#334155').text('TO:', 40, letterHeaderY + 16);
      doc.font('Helvetica').fillColor('#0F172A').text(`Designated Field Officer (${complaint.category_name || 'Public Works'})`, 90, letterHeaderY + 16);

      doc.font('Helvetica-Bold').fillColor('#334155').text('LOCATION:', 40, letterHeaderY + 32);
      doc.font('Helvetica').fillColor('#0F172A').text(`${complaint.village}, ${complaint.mandal} Mandal, ${complaint.district || 'Chittoor'} District`, 90, letterHeaderY + 32);

      // Formal Subject Line
      const subjY = letterHeaderY + 54;
      doc.rect(40, subjY, 515, 24).fill('#F1F5F9').stroke('#E2E8F0');
      doc.fillColor('#0F3D3E').fontSize(10).font('Helvetica-Bold')
         .text(`SUBJECT: Official Action Directive for ${complaint.category_name || 'Grievance'} Issue (Priority: ${sevUpper})`, 50, subjY + 7);

      // --- Section 1: MANDATORY OFFICIAL ENGLISH TRANSLATION ---
      const transTop = subjY + 35;
      doc.rect(40, transTop, 515, 75).fill('#FFFFFF').stroke('#0F3D3E');
      doc.fillColor('#0F3D3E').fontSize(10).font('Helvetica-Bold').text('1. OFFICIAL ENGLISH TRANSLATION OF CITIZEN GRIEVANCE LETTER:', 50, transTop + 8);
      doc.fillColor('#1E293B').fontSize(9.5).font('Helvetica').text(`"${cleanEnglishTrans}"`, 50, transTop + 24, { width: 495, leading: 1.4 });

      // --- Section 2: CITIZEN ORIGINAL TRANSCRIPT (NATIVE SCRIPT) ---
      const origTop = transTop + 85;
      doc.rect(40, origTop, 515, 65).fill('#F8FAFC').stroke('#E2E8F0');
      doc.fillColor('#475569').fontSize(10).font('Helvetica-Bold').text(`2. CITIZEN ORIGINAL VOICE / TEXT TRANSCRIPT (${complaint.detected_language || 'Native'}):`, 50, origTop + 8);
      doc.fillColor('#334155').fontSize(9).font('Helvetica-Oblique').text(`"${cleanOriginalNote}"`, 50, origTop + 24, { width: 495 });

      // --- Section 3: AI BRIEF PROBLEM ANALYSIS & EXECUTIVE FIELD DIRECTIVE ---
      const summaryTop = origTop + 75;
      doc.rect(40, summaryTop, 515, 80).fill('#EFF6FF').stroke('#BFDBFE');
      doc.fillColor('#1E40AF').fontSize(10).font('Helvetica-Bold').text('3. AI BRIEF PROBLEM ANALYSIS & EXECUTIVE FIELD DIRECTIVE:', 50, summaryTop + 8);
      
      const detailedAnalysis = `ANALYZED ISSUE: "${cleanEnglishTrans}"\nDEPARTMENT ALLOCATION: ${complaint.category_name || 'Public Infrastructure'} (Severity: ${sevUpper})\nEXECUTIVE ACTION DIRECTIVE: ${cleanSummary || 'Immediate field inspection, emergency repair crew dispatch, and status update on e-Governance portal required.'}`;

      doc.fillColor('#1E293B').fontSize(9).font('Helvetica').text(detailedAnalysis, 50, summaryTop + 24, { width: 495, leading: 1.35 });

      // --- Section 4: GPS LOCATION & FIELD METRICS ---
      const mapTop = summaryTop + 85;
      const mapsUrl = `https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`;
      doc.fillColor('#0F3D3E').fontSize(10).font('Helvetica-Bold').text('4. GPS LOCATION & CONTACT DETAILS:', 40, mapTop);
      doc.fillColor('#334155').fontSize(9).font('Helvetica')
         .text(`Citizen Mobile: +91 ${complaint.citizen_mobile}  |  GPS Coordinates: ${complaint.latitude}, ${complaint.longitude}`, 40, mapTop + 16);
      doc.fillColor('#2563EB').fontSize(9).font('Helvetica-Bold').text(`Google Maps Field Navigation: ${mapsUrl}`, 40, mapTop + 30, { link: mapsUrl, underline: true });

      // --- Official Signature & Stamp Box ---
      const stampY = 690;
      doc.strokeColor('#CBD5E1').lineWidth(1).moveTo(40, stampY).lineTo(555, stampY).stroke();

      doc.rect(380, stampY + 10, 175, 55).stroke('#CBD5E1');
      doc.fillColor('#475569').fontSize(8).font('Helvetica-Bold')
         .text('OFFICIAL DIGITAL STAMP & SIGNATURE', 385, stampY + 16, { width: 165, align: 'center' });
      doc.fillColor('#0F3D3E').fontSize(9).font('Helvetica-Bold')
         .text('CivicAI Automated Dispatch', 385, stampY + 32, { width: 165, align: 'center' });
      doc.fontSize(7).font('Helvetica')
         .text('Verified under e-Governance IT Act', 385, stampY + 46, { width: 165, align: 'center' });

      doc.fillColor('#64748B').fontSize(8).font('Helvetica')
         .text('This is an official government incident report generated by CivicAI. Electronically verified.', 40, stampY + 25);
      doc.text('CivicAI Public Grievance Redressal Platform', 40, stampY + 38);

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
