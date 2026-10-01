const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Seat = require('../models/Seat');
const Workspace = require('../models/Workspace');

const HOLD_MINUTES = Number(process.env.SEAT_HOLD_MINUTES) || 10;

/**
 * Helper: strips expired locks from a seat's bookedSlots so they no longer
 * block availability. This is called lazily on read/write instead of only
 * relying on a cron job, so availability is always accurate even if the
 * scheduled cleanup hasn't run yet.
 */
const pruneExpiredLocks = (seat) => {
  const now = Date.now();
  seat.bookedSlots = seat.bookedSlots.filter((slot) => {
    if (slot.status === 'locked' && slot.lockExpiresAt && slot.lockExpiresAt.getTime() < now) {
      return false; // expired lock — drop it, seat becomes available again
    }
    return true;
  });
};

// @desc    Get live seat map for a workspace on a given date + time slot
// @route   GET /api/seats/:workspaceId?date=YYYY-MM-DD&timeSlot=09:00-19:00
exports.getSeatMap = catchAsync(async (req, res, next) => {
  const { date, timeSlot } = req.query;
  if (!date || !timeSlot) return next(new AppError('date and timeSlot query params are required.', 400));

  const seats = await Seat.find({ workspace: req.params.workspaceId }).sort('row col');

  const seatMap = [];
  for (const seat of seats) {
    pruneExpiredLocks(seat);
    await seat.save();

    const slot = seat.bookedSlots.find((s) => s.date === date && s.timeSlot === timeSlot);
    let status = 'available';
    if (seat.isDisabled) status = 'disabled';
    else if (slot?.status === 'booked') status = 'booked';
    else if (slot?.status === 'locked') status = 'locked';

    seatMap.push({
      _id: seat._id,
      seatNumber: seat.seatNumber,
      row: seat.row,
      col: seat.col,
      status,
    });
  }

  res.status(200).json({ success: true, date, timeSlot, seats: seatMap });
});

// @desc    Temporarily lock seats while a user completes checkout (like a cinema hold)
// @route   POST /api/seats/lock
// @body    { workspaceId, seatIds: [], date, timeSlot }
exports.lockSeats = catchAsync(async (req, res, next) => {
  const { workspaceId, seatIds, date, timeSlot } = req.body;
  if (!workspaceId || !seatIds?.length || !date || !timeSlot) {
    return next(new AppError('workspaceId, seatIds, date, and timeSlot are required.', 400));
  }

  const lockExpiresAt = new Date(Date.now() + HOLD_MINUTES * 60 * 1000);
  const lockedSeats = [];
  const conflicts = [];

  // Process sequentially so we can safely detect + reject conflicts per seat.
  for (const seatId of seatIds) {
    const seat = await Seat.findOne({ _id: seatId, workspace: workspaceId });
    if (!seat || seat.isDisabled) {
      conflicts.push(seatId);
      continue;
    }

    pruneExpiredLocks(seat);

    const existing = seat.bookedSlots.find((s) => s.date === date && s.timeSlot === timeSlot);
    if (existing) {
      // Already booked, or locked by someone else — reject (prevents double booking)
      if (existing.status === 'booked' || existing.lockedBy?.toString() !== req.user._id.toString()) {
        conflicts.push(seatId);
        continue;
      }
    }

    if (!existing) {
      seat.bookedSlots.push({
        date, timeSlot, status: 'locked', lockedBy: req.user._id, lockExpiresAt,
      });
    } else {
      existing.lockExpiresAt = lockExpiresAt;
    }

    await seat.save();
    lockedSeats.push(seatId);
  }

  if (conflicts.length > 0) {
    return res.status(409).json({
      success: false,
      message: 'Some seats are no longer available.',
      lockedSeats,
      conflicts,
    });
  }

  res.status(200).json({
    success: true,
    message: `Seats held for ${HOLD_MINUTES} minutes.`,
    lockedSeats,
    lockExpiresAt,
  });
});

// @desc    Release a lock manually (e.g. user navigates away / deselects a seat)
// @route   POST /api/seats/unlock
exports.unlockSeats = catchAsync(async (req, res) => {
  const { workspaceId, seatIds, date, timeSlot } = req.body;

  await Seat.updateMany(
    { _id: { $in: seatIds }, workspace: workspaceId },
    { $pull: { bookedSlots: { date, timeSlot, status: 'locked', lockedBy: req.user._id } } }
  );

  res.status(200).json({ success: true, message: 'Seats released.' });
});

module.exports.pruneExpiredLocks = pruneExpiredLocks;
