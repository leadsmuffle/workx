const path = require('path');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Invoice = require('../models/Invoice');
const Booking = require('../models/Booking');
const sendEmail = require('../utils/sendEmail');
const { bookingConfirmationTemplate } = require('../utils/emailTemplates');

// @desc    Download invoice PDF (owner or admin)
// @route   GET /api/invoices/:id/download
exports.downloadInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id);
  if (!invoice) return next(new AppError('Invoice not found.', 404));

  if (req.user.role !== 'admin' && invoice.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not have access to this invoice.', 403));
  }

  res.download(path.join(__dirname, '..', invoice.pdfPath), `${invoice.invoiceNumber}.pdf`);
});

// @desc    Re-send invoice by email
// @route   POST /api/invoices/:id/email
exports.emailInvoice = catchAsync(async (req, res, next) => {
  const invoice = await Invoice.findById(req.params.id).populate('user').populate('booking');
  if (!invoice) return next(new AppError('Invoice not found.', 404));

  if (req.user.role !== 'admin' && invoice.user._id.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not have access to this invoice.', 403));
  }

  await sendEmail({
    to: invoice.user.email,
    subject: `Your WorkX invoice — ${invoice.invoiceNumber}`,
    html: bookingConfirmationTemplate(invoice.user.firstName, {
      bookingId: invoice.booking.bookingId,
      workspaceName: invoice.workspaceName,
      date: invoice.bookingDate,
      timeSlot: invoice.timeSlot,
      seats: invoice.seatNumbers.join(', '),
      total: invoice.total,
    }),
    attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, path: path.join(__dirname, '..', invoice.pdfPath) }],
  });

  invoice.emailedAt = new Date();
  await invoice.save();

  res.status(200).json({ success: true, message: 'Invoice emailed successfully.' });
});
