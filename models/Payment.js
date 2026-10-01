const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema(
  {
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking', required: true },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    method: { type: String, enum: ['stripe', 'jazzcash', 'easypaisa'], required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: 'PKR' },
    status: { type: String, enum: ['pending', 'success', 'failed', 'refunded'], default: 'pending' },
    transactionId: { type: String }, // gateway transaction reference
    gatewayResponse: { type: mongoose.Schema.Types.Mixed }, // raw response, useful for debugging/audit
    refundedAmount: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Payment', paymentSchema);
