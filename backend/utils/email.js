const nodemailer = require('nodemailer');

// Uses Gmail SMTP with an "App Password" — no business verification needed.
// Setup: Google Account → Security → 2-Step Verification (turn on) →
// App Passwords → generate one for "Mail" → put it in EMAIL_APP_PASSWORD.
const configured = !!process.env.EMAIL_USER && !!process.env.EMAIL_APP_PASSWORD;

const transporter = configured
  ? nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_APP_PASSWORD,
    },
  })
  : null;

async function sendEmail(to, subject, text) {
  if (!to) {
    console.warn('[EMAIL SKIPPED] No email address on file for this recipient.');
    return { skipped: true };
  }
  if (!transporter) {
    console.warn('[EMAIL DISABLED] Would send to', to, '- Subject:', subject);
    console.warn(text);
    return { simulated: true };
  }
  try {
    return await transporter.sendMail({
      from: `"Vote Nepal" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      text,
    });
  } catch (err) {
    // Email delivery must NEVER crash the server or block the action
    // that triggered it (registration, approval, rejection, etc).
    console.error('[EMAIL FAILED]', to, '-', err.message);
    console.warn('[EMAIL FALLBACK] Message that failed to send:', text);
    return { failed: true, error: err.message };
  }
}

module.exports = { sendEmail };
