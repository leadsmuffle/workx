const Invoice = require('../models/Invoice');
const generateInvoicePDF = require('./generateInvoicePDF');
const sendEmail = require('./sendEmail');
const { bookingConfirmationTemplate } = require('./emailTemplates');
const { uploadToBlob } = require('./blobStorage');

let invoiceCounter = Date.now() % 1000000; // simple in-memory fallback; swap for a DB counter collection in high-concurrency prod

const generateInvoiceNumber = () => {
  invoiceCounter += 1;
  return `INV-${new Date().getFullYear()}-${String(invoiceCounter).padStart(6, '0')}`;
};

/**
 * Creates an Invoice document + PDF for a confirmed & paid booking,
 * attaches it to the booking, and emails it to the customer.
 * Called from the payment success handlers (Stripe webhook / JazzCash / EasyPaisa callback).
 */
const createAndSendInvoice = async (booking, user, workspace) => {
  const invoiceNumber = generateInvoiceNumber();

  const invoiceData = {
    invoiceNumber,
    bookingId: booking.bookingId,
    customerName: user.fullName || `${user.firstName} ${user.lastName}`,
    customerEmail: user.email,
    customerPhone: user.phone,
    workspaceName: workspace.name,
    seatNumbers: booking.seats.map((s) => s.seatNumber),
    bookingDate: booking.date,
    timeSlot: booking.timeSlot,
    quantity: booking.quantity,
    unitPrice: booking.unitPrice,
    tax: booking.tax,
    total: booking.total,
  };

  const { pdfBuffer, qrData } = await generateInvoicePDF(invoiceData);
  const pdfUrl = await uploadToBlob(`invoices/${invoiceNumber}.pdf`, pdfBuffer, 'application/pdf');

  const invoice = await Invoice.create({
    invoiceNumber,
    booking: booking._id,
    user: user._id,
    ...invoiceData,
    pdfPath: pdfUrl,
    qrCodeData: qrData,
  });

  booking.invoice = invoice._id;
  await booking.save();

  try {
    await sendEmail({
      to: user.email,
      subject: `Your WorkX invoice — ${invoice.invoiceNumber}`,
      html: bookingConfirmationTemplate(user.firstName, {
        bookingId: booking.bookingId,
        workspaceName: workspace.name,
        date: booking.date,
        timeSlot: booking.timeSlot,
        seats: booking.seats.map((s) => s.seatNumber).join(', '),
        total: booking.total,
      }),
      attachments: [{ filename: `${invoice.invoiceNumber}.pdf`, content: pdfBuffer }],
    });
    invoice.emailedAt = new Date();
    await invoice.save();
  } catch (err) {
    console.error('Failed to email invoice:', err.message);
  }

  return invoice;
};

module.exports = { createAndSendInvoice, generateInvoiceNumber };
