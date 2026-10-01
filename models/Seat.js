const mongoose = require('mongoose');

/**
 * A Seat belongs to a Workspace. Availability is tracked PER DATE + TIME SLOT
 * via the `bookedSlots` array rather than a single global status, so the same
 * physical seat can be free tomorrow even if booked today.
 */
const seatSchema = new mongoose.Schema(
  {
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    seatNumber: { type: String, required: true }, // e.g. "A1", "S12"
    row: { type: Number, default: 0 },
    col: { type: Number, default: 0 },
    isDisabled: { type: Boolean, default: false }, // permanently out of service
    bookedSlots: [
      {
        date: { type: String, required: true }, // YYYY-MM-DD
        timeSlot: { type: String, required: true }, // e.g. "09:00-19:00"
        status: { type: String, enum: ['locked', 'booked'], default: 'locked' },
        lockedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        lockExpiresAt: { type: Date }, // only relevant while status = 'locked'
        booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' },
      },
    ],
  },
  { timestamps: true }
);

seatSchema.index({ workspace: 1, seatNumber: 1 }, { unique: true });

module.exports = mongoose.model('Seat', seatSchema);
