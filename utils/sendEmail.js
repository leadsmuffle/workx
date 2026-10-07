const nodemailer = require('nodemailer');

// Accepts either naming convention for these env vars, since different hosts/
// panels (e.g. Hostinger's own examples) commonly suggest SMTP_USER/SMTP_PASS/
// MAIL_FROM instead of this project's original SMTP_EMAIL/SMTP_PASSWORD/
// EMAIL_FROM — a mismatch here previously made SMTP auth silently fail.
const SMTP_USER = process.env.SMTP_EMAIL || process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASSWORD || process.env.SMTP_PASS;
const SMTP_SECURE = process.env.SMTP_SECURE !== undefined ? process.env.SMTP_SECURE === 'true' : true;

// Most SMTP providers (Hostinger included) reject a send if the "From" email
// address doesn't match the authenticated mailbox (SMTP_USER) — e.g. logging
// in as hr@workx.pk but sending "From: no-reply@workx.pk" gets a 553 "Sender
// address rejected: not owned by user" error. So: take only the DISPLAY NAME
// from EMAIL_FROM/MAIL_FROM if one was provided (e.g. "WorkX" out of
// '"WorkX" <no-reply@workx.pk>'), but always force the actual address to be
// SMTP_USER, which is guaranteed to be the account that's actually allowed to send.
const rawMailFrom = process.env.EMAIL_FROM || process.env.MAIL_FROM || '';
const displayNameMatch = rawMailFrom.match(/^\s*"?([^"<]*?)"?\s*<.+>\s*$/);
const FROM_DISPLAY_NAME = (displayNameMatch ? displayNameMatch[1].trim() : '') || 'WorkX';
const MAIL_FROM = `"${FROM_DISPLAY_NAME}" <${SMTP_USER}>`;

/**
 * Creates a reusable Nodemailer transporter.
 * Requires an app-specific SMTP password (not a normal account password) in
 * SMTP_PASSWORD (or SMTP_PASS).
 */
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
  });

/**
 * Sends an email.
 * @param {Object} options
 * @param {String} options.to
 * @param {String} options.subject
 * @param {String} options.html
 * @param {Array}  [options.attachments]
 */
const sendEmail = async ({ to, subject, html, attachments = [] }) => {
  const transporter = createTransporter();

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject,
    html,
    attachments,
  });
};

module.exports = sendEmail;
