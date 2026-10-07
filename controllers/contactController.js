const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Contact = require('../models/Contact');
const sendEmail = require('../utils/sendEmail');
const { contactAdminTemplate } = require('../utils/emailTemplates');

// Every lead/inquiry form on the site (Hero Enquiry, Contact, Landlord Property
// Submission) sends here and lands in this inbox. Falls back to a hardcoded
// default if ADMIN_EMAIL is ever missing/misconfigured in production, since
// losing leads silently is worse than a wrong destination address.
const LEAD_EMAIL = process.env.ADMIN_EMAIL || 'Hr@workx.pk';

// @desc    Submit any on-site lead/inquiry form (saves to DB + emails the team)
// @route   POST /api/contact
exports.submitContact = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, phone, message, formName, pageUrl, extra, website } = req.body;

  // Honeypot: a hidden field real visitors never fill in. Bots that
  // autofill every input will populate it, so silently drop the submission
  // without revealing to the bot that it was rejected.
  if (website) {
    return res.status(201).json({ success: true, message: 'Thanks! We will get back to you shortly.' });
  }

  if (phone && !/^[0-9+()\-.\s]{7,20}$/.test(phone)) {
    return next(new AppError('Please enter a valid phone number.', 400));
  }

  const contact = await Contact.create({
    firstName,
    lastName,
    email,
    phone,
    message: message || '(no message provided)',
    formName: formName || 'Contact Form',
    pageUrl,
    extra: extra && typeof extra === 'object' ? extra : undefined,
  });

  const leadName = `${firstName || ''} ${lastName || ''}`.trim() || contact.formName;
  await sendEmail({
    to: LEAD_EMAIL,
    subject: `New WorkX Website Lead - ${leadName}`,
    html: contactAdminTemplate(contact),
  }).catch((err) => console.error('Failed to email the team about a new lead:', err.message));

  res.status(201).json({ success: true, message: 'Thanks! We will get back to you shortly.' });
});

// @desc    List all contact messages (admin)
// @route   GET /api/contact
exports.getAllContacts = catchAsync(async (req, res) => {
  const { status } = req.query;
  const filter = status ? { status } : {};
  const contacts = await Contact.find(filter).sort('-createdAt');
  res.status(200).json({ success: true, count: contacts.length, contacts });
});

// @desc    Mark a message as read/responded (admin)
// @route   PATCH /api/contact/:id
exports.updateContactStatus = catchAsync(async (req, res) => {
  const contact = await Contact.findByIdAndUpdate(req.params.id, { status: req.body.status }, { new: true });
  res.status(200).json({ success: true, contact });
});
