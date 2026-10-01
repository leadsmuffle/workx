const nodemailer = require('nodemailer');

/**
 * Creates a reusable Nodemailer transporter using Gmail SMTP.
 * Requires a Google App Password (not the normal account password) in SMTP_PASSWORD.
 */
const createTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 465,
    secure: true,
    auth: {
      user: process.env.SMTP_EMAIL,
      pass: process.env.SMTP_PASSWORD,
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
    from: process.env.EMAIL_FROM || `"WorkX" <${process.env.SMTP_EMAIL}>`,
    to,
    subject,
    html,
    attachments,
  });
};

module.exports = sendEmail;
