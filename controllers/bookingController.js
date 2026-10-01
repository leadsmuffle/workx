const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Workspace = require('../models/Workspace');
const Notification = require('../models/Notification');

const HOLD_MINUTES = Number(process.env.SEAT_HOLD_MINUTES) || 10;
const TAX_RATE = 0.0; // adjust if you need to charge GST/sales tax

const generateBookingId = () => 'WX-' + Math.floor(100000 + Math.random() * 900000);

// @desc    Create a booking from previously locked seats
// @route   POST /api/bookings
// @body    { workspaceId, seatIds, date, timeSlot }
exports.createBooking = catchAsync(async (req, res, next) => {
  const { workspaceId, seatIds, date, timeSlot } = req.body;
  if (!workspaceId || !seatIds?.length || !date || !timeSlot) {
    return next(new AppError('workspaceId, seatIds, date, and timeSlot are required.', 400));
  }

  const workspace = await Workspace.findById(workspaceId);
  if (!workspace) return next(new AppError('Workspace not found.', 404));

  const seatNumbers = [];
  const seatRefs = [];

  // Verify every seat is still locked BY THIS USER (not booked/expired/locked by someone else)
  for (const seatId of seatIds) {
    const seat = await Seat.findOne({ _id: seatId, workspace: workspaceId });
    if (!seat) return next(new AppError(`Seat ${seatId} not found.`, 404));

    const slot = seat.bookedSlots.find((s) => s.date === date && s.timeSlot === timeSlot);
    const validLock =
      slot &&
      slot.status === 'locked' &&
      slot.lockedBy?.toString() === req.user._id.toString() &&
      slot.lockExpiresAt &&
      slot.lockExpiresAt.getTime() > Date.now();

    if (!validLock) {
      return next(new AppError(`Seat ${seat.seatNumber} is no longer held for you. Please reselect your seats.`, 409));
    }

    seatNumbers.push(seat.seatNumber);
    seatRefs.push({ seat: seat._id, seatNumber: seat.seatNumber });
  }

  const quantity = seatIds.length;
  const unitPrice = workspace.pricePerDay;
  const subtotal = unitPrice * quantity;
  const tax = Math.round(subtotal * TAX_RATE);
  const total = subtotal + tax;

  const booking = await Booking.create({
    bookingId: generateBookingId(),
    user: req.user._id,
    workspace: workspace._id,
    seats: seatRefs,
    city: workspace.city,
    date,
    timeSlot,
    quantity,
    unitPrice,
    subtotal,
    tax,
    total,
    status: 'pending',
    holdExpiresAt: new Date(Date.now() + HOLD_MINUTES * 60 * 1000),
  });

  // Attach the booking reference to each seat's slot (still status=locked until payment succeeds)
  for (const seatId of seatIds) {
    await Seat.updateOne(
      { _id: seatId, 'bookedSlots.date': date, 'bookedSlots.timeSlot': timeSlot },
      { $set: { 'bookedSlots.$.booking': booking._id } }
    );
  }

  await Notification.create({
    forAdmin: true,
    type: 'booking',
    title: 'New booking created',
    message: `${req.user.fullName || req.user.firstName} booked ${quantity} seat(s) at ${workspace.name}.`,
    meta: { bookingId: booking.bookingId },
  });

  res.status(201).json({
    success: true,
    message: 'Booking created. Please complete payment within the hold window.',
    booking,
  });
});

// @desc    Get single booking
// @route   GET /api/bookings/:id
exports.getBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id).populate('workspace').populate('invoice').populate('payment');
  if (!booking) return next(new AppError('Booking not found.', 404));

  // Users can only view their own booking; admins can view any
  if (req.user.role !== 'admin' && booking.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not have access to this booking.', 403));
  }

  res.status(200).json({ success: true, booking });
});

// @desc    Cancel a booking
// @route   PATCH /api/bookings/:id/cancel
exports.cancelBooking = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (req.user.role !== 'admin' && booking.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not have access to this booking.', 403));
  }

  if (['cancelled', 'completed'].includes(booking.status)) {
    return next(new AppError(`Booking is already ${booking.status}.`, 400));
  }

  booking.status = 'cancelled';
  booking.cancelledAt = new Date();
  booking.cancellationReason = req.body.reason || 'Cancelled by user';
  await booking.save();

  // Free up the seats immediately
  const seatIds = booking.seats.map((s) => s.seat);
  await Seat.updateMany(
    { _id: { $in: seatIds } },
    { $pull: { bookedSlots: { date: booking.date, timeSlot: booking.timeSlot, booking: booking._id } } }
  );

  res.status(200).json({ success: true, message: 'Booking cancelled.', booking });
});

// @desc    Reschedule a booking to a new date/time (only if still pending/confirmed and unpaid slot is free)
// @route   PATCH /api/bookings/:id/reschedule
exports.rescheduleBooking = catchAsync(async (req, res, next) => {
  const { date, timeSlot } = req.body;
  const booking = await Booking.findById(req.params.id);
  if (!booking) return next(new AppError('Booking not found.', 404));

  if (booking.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You do not have access to this booking.', 403));
  }
  if (booking.status === 'cancelled') return next(new AppError('Cannot reschedule a cancelled booking.', 400));

  const seatIds = booking.seats.map((s) => s.seat);

  // Check the new slot is free for all seats
  const seats = await Seat.find({ _id: { $in: seatIds } });
  for (const seat of seats) {
    const clash = seat.bookedSlots.find(
      (s) => s.date === date && s.timeSlot === timeSlot && s.booking?.toString() !== booking._id.toString()
    );
    if (clash) return next(new AppError(`Seat ${seat.seatNumber} is not available at the new time.`, 409));
  }

  // Move the booking reference on each seat to the new date/time
  for (const seat of seats) {
    seat.bookedSlots = seat.bookedSlots.filter((s) => s.booking?.toString() !== booking._id.toString());
    seat.bookedSlots.push({ date, timeSlot, status: 'booked', booking: booking._id });
    await seat.save();
  }

  booking.date = date;
  booking.timeSlot = timeSlot;
  await booking.save();

  res.status(200).json({ success: true, message: 'Booking rescheduled.', booking });
});

// @desc    List all bookings (admin) with filters
// @route   GET /api/bookings
exports.getAllBookings = catchAsync(async (req, res) => {
  const { status, city, from, to, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (status) filter.status = status;
  if (city) filter.city = city;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }

  const skip = (Number(page) - 1) * Number(limit);
  const [bookings, total] = await Promise.all([
    Booking.find(filter).populate('user', 'firstName lastName email').populate('workspace', 'name city').sort('-createdAt').skip(skip).limit(Number(limit)),
    Booking.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: bookings.length, total, page: Number(page), pages: Math.ceil(total / limit), bookings });
});

/**
 * Background job: expires stale "pending" bookings whose hold window passed
 * without payment, freeing the associated seats. Call this on an interval
 * from server.js (setInterval) or wire it to a proper cron/queue in production.
 */
exports.expireStaleBookings = async () => {
  const stale = await Booking.find({ status: 'pending', holdExpiresAt: { $lt: new Date() } });

  for (const booking of stale) {
    booking.status = 'expired';
    await booking.save();

    const seatIds = booking.seats.map((s) => s.seat);
    await Seat.updateMany(
      { _id: { $in: seatIds } },
      { $pull: { bookedSlots: { date: booking.date, timeSlot: booking.timeSlot, booking: booking._id } } }
    );
  }

  if (stale.length > 0) console.log(`Expired ${stale.length} stale booking(s).`);
};
