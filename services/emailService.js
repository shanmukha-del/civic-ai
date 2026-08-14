/**
 * Official Onboarding Email Dispatcher Service for CivicAI
 * Uses Nodemailer with SMTP support & Ethereal email fallback.
 */

const nodemailer = require('nodemailer');
require('dotenv').config();

let transporter = null;

async function getTransporter() {
  if (transporter) return transporter;

  if (process.env.SMTP_USER && process.env.SMTP_PASS) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Generate zero-cost Ethereal test account for real SMTP email dispatching
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass
        }
      });
      console.log(`📧 Nodemailer Ethereal SMTP test engine ready. User: ${testAccount.user}`);
    } catch (e) {
      console.warn('⚠️ Ethereal account creation failed, fallback to console log:', e.message);
    }
  }

  return transporter;
}

async function sendOfficerOnboardingEmail(officerData) {
  const { name, email, username, password, departmentName, village, mandal, district } = officerData;

  const htmlContent = `
    <div style="font-family: Arial, sans-serif; background-color: #f8fafc; padding: 20px; color: #0f172a;">
      <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 12px; border: 1px solid #e2e8f0; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: #0f766e; color: #ffffff; padding: 20px; text-align: center;">
          <h2 style="margin: 0; font-size: 20px;">CivicAI Field Officer Onboarding</h2>
          <p style="margin: 5px 0 0 0; font-size: 12px; color: #99f6e4;">Government Grievance Action Platform</p>
        </div>
        
        <div style="padding: 24px;">
          <p style="font-size: 14px; font-weight: bold; margin-top: 0;">Dear ${name},</p>
          <p style="font-size: 13px; color: #334155; leading: 1.6;">
            Welcome to <strong>CivicAI</strong>. You have been officially appointed as the designated Field Officer for <strong>${departmentName || 'Public Works'}</strong>.
          </p>

          <div style="background: #f1f5f9; padding: 15px; border-radius: 8px; margin: 16px 0; font-size: 13px;">
            <div style="margin-bottom: 6px;"><strong>Assigned Jurisdiction:</strong> ${village}, ${mandal} (${district})</div>
            <div style="margin-bottom: 6px;"><strong>Initial Username:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #0f766e;">${username}</code></div>
            <div><strong>Temporary Password:</strong> <code style="background: #e2e8f0; padding: 2px 6px; border-radius: 4px; color: #0f766e;">${password}</code></div>
          </div>

          <div style="background: #fef3c7; border: 1px solid #fde68a; color: #92400e; padding: 12px; border-radius: 8px; font-size: 12px; margin-bottom: 20px;">
            <strong>SECURITY NOTICE:</strong> You must log in at <a href="http://localhost:3000/portal/login" style="color: #0f766e; font-weight: bold;">http://localhost:3000/portal/login</a> and set your permanent password on first login.
          </div>

          <div style="text-align: center;">
            <a href="http://localhost:3000/portal/login" style="background: #0f766e; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 8px; font-weight: bold; font-size: 13px; display: inline-block;">Access Officer Dashboard</a>
          </div>
        </div>

        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 12px; text-align: center; font-size: 11px; color: #64748b;">
          CivicAI Smart Multilingual Grievance & Incident Action Platform
        </div>
      </div>
    </div>
  `;

  try {
    const mailEngine = await getTransporter();
    if (mailEngine) {
      const info = await mailEngine.sendMail({
        from: '"CivicAI Officer Portal" <onboarding@civicai.gov.in>',
        to: email,
        subject: `CivicAI Officer Onboarding Credentials - ${departmentName}`,
        html: htmlContent
      });

      const previewUrl = nodemailer.getTestMessageUrl(info);
      console.log(`=======================================================`);
      console.log(`📧 OFFICIAL ONBOARDING EMAIL SENT TO: ${email}`);
      if (previewUrl) {
        console.log(`🔗 VIEW EMAIL PREVIEW: ${previewUrl}`);
      }
      console.log(`=======================================================`);

      return { success: true, status: 'Sent', messageId: info.messageId, previewUrl };
    }
  } catch (err) {
    console.error('⚠️ Nodemailer dispatch error:', err.message);
  }

  return { success: true, status: 'Simulated' };
}

module.exports = {
  sendOfficerOnboardingEmail
};
