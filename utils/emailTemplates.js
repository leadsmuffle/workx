/**
 * Centralized HTML email templates.
 * Kept as simple table-based HTML for maximum email-client compatibility.
 */

const wrapper = (title, bodyHtml) => `
<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#F7F8F6;font-family:Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#F7F8F6;padding:32px 0;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #E4E7E1;">
        <tr><td style="background:#0B0C0A;padding:24px 32px;">
          <span style="color:#ffffff;font-size:22px;font-weight:800;">Work<span style="color:#22C55E;">X</span></span>
        </td></tr>
        <tr><td style="padding:32px;">
          <h2 style="color:#0B0C0A;margin:0 0 16px;">${title}</h2>
          ${bodyHtml}
        </td></tr>
        <tr><td style="padding:20px 32px;background:#F7F8F6;color:#6B7069;font-size:12px;">
          © ${new Date().getFullYear()} WorkX. All rights reserved.
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;

exports.verifyEmailTemplate = (name, verifyUrl) =>
  wrapper(
    `Welcome, ${name}!`,
    `<p style="color:#333;line-height:1.6;">Thanks for creating a WorkX account. Please verify your email address to activate your account.</p>
     <p style="text-align:center;margin:28px 0;">
       <a href="${verifyUrl}" style="background:#22C55E;color:#fff;padding:14px 28px;border-radius:100px;text-decoration:none;font-weight:600;">Verify Email</a>
     </p>
     <p style="color:#999;font-size:13px;">If the button doesn't work, copy this link: ${verifyUrl}</p>`
  );

exports.resetPasswordTemplate = (name, resetUrl) =>
  wrapper(
    `Reset your password`,
    `<p style="color:#333;line-height:1.6;">Hi ${name}, we received a request to reset your password. This link expires in 10 minutes.</p>
     <p style="text-align:center;margin:28px 0;">
       <a href="${resetUrl}" style="background:#22C55E;color:#fff;padding:14px 28px;border-radius:100px;text-decoration:none;font-weight:600;">Reset Password</a>
     </p>
     <p style="color:#999;font-size:13px;">If you didn't request this, you can safely ignore this email.</p>`
  );

exports.bookingConfirmationTemplate = (name, booking) =>
  wrapper(
    `Booking confirmed!`,
    `<p style="color:#333;line-height:1.6;">Hi ${name}, your booking is confirmed. Details below:</p>
     <table style="width:100%;border-collapse:collapse;margin:16px 0;">
       <tr><td style="padding:6px 0;color:#6B7069;">Booking ID</td><td style="text-align:right;font-weight:600;">${booking.bookingId}</td></tr>
       <tr><td style="padding:6px 0;color:#6B7069;">Workspace</td><td style="text-align:right;">${booking.workspaceName}</td></tr>
       <tr><td style="padding:6px 0;color:#6B7069;">Date</td><td style="text-align:right;">${booking.date}</td></tr>
       <tr><td style="padding:6px 0;color:#6B7069;">Time Slot</td><td style="text-align:right;">${booking.timeSlot}</td></tr>
       <tr><td style="padding:6px 0;color:#6B7069;">Seats</td><td style="text-align:right;">${booking.seats}</td></tr>
       <tr><td style="padding:10px 0;color:#0B0C0A;font-weight:700;border-top:1px dashed #E4E7E1;">Total</td><td style="text-align:right;font-weight:700;border-top:1px dashed #E4E7E1;">PKR ${booking.total}</td></tr>
     </table>
     <p style="color:#333;">Your invoice is attached to this email.</p>`
  );

exports.paymentSuccessTemplate = (name, amount, bookingId) =>
  wrapper(
    `Payment received`,
    `<p style="color:#333;line-height:1.6;">Hi ${name}, we've received your payment of <strong>PKR ${amount}</strong> for booking <strong>${bookingId}</strong>.</p>`
  );

exports.bookingCancellationTemplate = (name, bookingId) =>
  wrapper(
    `Booking cancelled`,
    `<p style="color:#333;line-height:1.6;">Hi ${name}, your booking <strong>${bookingId}</strong> has been cancelled as requested. If eligible, any refund will be processed within 5-7 business days.</p>`
  );

// Renders every field a lead submission actually has — core fields first, then
// any form-specific extras (company, size, requirement, property details, etc.)
// — so no submitted information is dropped from the notification email,
// regardless of which on-site form it came from.
const escapeHtml = (val) =>
  String(val ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const row = (label, value) =>
  value === undefined || value === null || value === ''
    ? ''
    : `<tr><td style="padding:6px 10px 6px 0;color:#6B7069;white-space:nowrap;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:6px 0;">${escapeHtml(value)}</td></tr>`;

// Turns a camelCase/snake_case field key into a readable label, e.g. "propertyType" -> "Property Type"
const labelize = (key) =>
  key
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

exports.contactAdminTemplate = (contact) => {
  const extraRows = contact.extra
    ? Object.entries(contact.extra)
        .map(([key, value]) => row(labelize(key), value))
        .join('')
    : '';

  return wrapper(
    `New WorkX website lead`,
    `<table style="width:100%;border-collapse:collapse;">
       ${row('Form', contact.formName)}
       ${row('Name', `${contact.firstName || ''} ${contact.lastName || ''}`.trim())}
       ${row('Email', contact.email)}
       ${row('Phone', contact.phone)}
       ${extraRows}
       ${row('Message', contact.message)}
       ${row('Page URL', contact.pageUrl)}
       ${row('Submitted', new Date(contact.createdAt || Date.now()).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }))}
     </table>`
  );
};
