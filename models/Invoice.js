const mongoose = require('mongoose');

const invoiceSchema = new mongoose.Schema(
  {
    invoiceNumber: { type: String, unique: true, required: true }, // e.g. INV-2026-000123
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    customerName: String,
    customerEmail: String,
    customerPhone: String,
    workspaceName: String,
    seatNumbers: [String],
    bookingDate: String,
    timeSlot: String,
    quantity: Number,
    unitPrice: Number,
    tax: Number,
    total: Number,
    pdfPath: String, // relative path where the generated PDF is stored
    qrCodeData: String,
    emailedAt: Date,
  },
  { timestamps: true }
);

module.exports = mongoose.model('Invoice', invoiceSchema);
