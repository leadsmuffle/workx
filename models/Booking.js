const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema(
  {
    bookingId: { type: String, unique: true, required: true }, // e.g. WX-482913
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    seats: [
      {
        seat: { type: mongoose.Schema.Types.ObjectId, ref: 'Seat' },
        seatNumber: String,
      },
    ],
    city: { type: String, required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    timeSlot: { type: String, required: true },
    quantity: { type: Number, required: true, default: 1 },
    unitPrice: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true, default: 0 },
    total: { type: Number, required: true },
    status: {
      type: String,
      enum: ['pending', 'confirmed', 'cancelled', 'completed', 'expired'],
      default: 'pending',
    },
    paymentStatus: { type: String, enum: ['unpaid', 'paid', 'refunded', 'failed'], default: 'unpaid' },
    payment: { type: mongoose.Schema.Types.ObjectId, ref: 'Payment' },
    invoice: { type: mongoose.Schema.Types.ObjectId, ref: 'Invoice' },
    holdExpiresAt: { type: Date }, // pending bookings auto-expire if unpaid
    cancelledAt: Date,
    cancellationReason: String,
  },
  { timestamps: true }
);

bookingSchema.index({ user: 1, createdAt: -1 });
bookingSchema.index({ status: 1, holdExpiresAt: 1 });

module.exports = mongoose.model('Booking', bookingSchema);
