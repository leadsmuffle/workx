const catchAsync = require('../utils/catchAsync');
const Contact = require('../models/Contact');
const sendEmail = require('../utils/sendEmail');
const { contactAdminTemplate } = require('../utils/emailTemplates');

// @desc    Submit the contact form (saves to DB + emails admin)
// @route   POST /api/contact
exports.submitContact = catchAsync(async (req, res) => {
  const { firstName, lastName, email, phone, message } = req.body;

  const contact = await Contact.create({ firstName, lastName, email, phone, message });

  await sendEmail({
    to: process.env.ADMIN_EMAIL, // Amjad Ali — shahzadamjad999@gmail.com
    subject: `New WorkX contact message from ${firstName} ${lastName}`,
    html: contactAdminTemplate(contact),
  }).catch((err) => console.error('Failed to email admin about contact form:', err.message));

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
