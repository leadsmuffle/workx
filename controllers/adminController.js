const { Parser } = require('json2csv');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Booking = require('../models/Booking');
const Payment = require('../models/Payment');
const Review = require('../models/Review');
const Contact = require('../models/Contact');

// @desc    Dashboard statistics
// @route   GET /api/admin/stats
exports.getDashboardStats = catchAsync(async (req, res) => {
  const [totalUsers, totalWorkspaces, totalBookings, activeBookings, revenueAgg, todayBookings] = await Promise.all([
    User.countDocuments({ role: 'user' }),
    Workspace.countDocuments(),
    Booking.countDocuments(),
    Booking.countDocuments({ status: 'confirmed' }),
    Payment.aggregate([{ $match: { status: 'success' } }, { $group: { _id: null, total: { $sum: '$amount' } } }]),
    Booking.countDocuments({ createdAt: { $gte: new Date(new Date().setHours(0, 0, 0, 0)) } }),
  ]);

  // Revenue trend for last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const revenueTrend = await Payment.aggregate([
    { $match: { status: 'success', createdAt: { $gte: thirtyDaysAgo } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        total: { $sum: '$amount' },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  // Top workspaces by bookings
  const topWorkspaces = await Booking.aggregate([
    { $match: { status: { $in: ['confirmed', 'completed'] } } },
    { $group: { _id: '$workspace', bookings: { $sum: 1 }, revenue: { $sum: '$total' } } },
    { $sort: { bookings: -1 } },
    { $limit: 5 },
    { $lookup: { from: 'workspaces', localField: '_id', foreignField: '_id', as: 'workspace' } },
    { $unwind: '$workspace' },
    { $project: { name: '$workspace.name', city: '$workspace.city', bookings: 1, revenue: 1 } },
  ]);

  res.status(200).json({
    success: true,
    stats: {
      totalUsers,
      totalWorkspaces,
      totalBookings,
      activeBookings,
      todayBookings,
      totalRevenue: revenueAgg[0]?.total || 0,
    },
    revenueTrend,
    topWorkspaces,
  });
});

// @desc    List / search users
// @route   GET /api/admin/users
exports.getUsers = catchAsync(async (req, res) => {
  const { search, role, page = 1, limit = 20 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  if (search) {
    filter.$or = [
      { firstName: new RegExp(search, 'i') },
      { lastName: new RegExp(search, 'i') },
      { email: new RegExp(search, 'i') },
    ];
  }

  const skip = (page - 1) * limit;
  const [users, total] = await Promise.all([
    User.find(filter).skip(skip).limit(Number(limit)).sort('-createdAt'),
    User.countDocuments(filter),
  ]);

  res.status(200).json({ success: true, count: users.length, total, users });
});

// @desc    Update a user (role, isActive)
// @route   PATCH /api/admin/users/:id
exports.updateUser = catchAsync(async (req, res, next) => {
  const allowed = ['role', 'isActive', 'firstName', 'lastName', 'phone'];
  const updates = {};
  allowed.forEach((key) => { if (req.body[key] !== undefined) updates[key] = req.body[key]; });

  const user = await User.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true });
  if (!user) return next(new AppError('User not found.', 404));

  res.status(200).json({ success: true, message: 'User updated', user });
});

// @desc    Delete a user
// @route   DELETE /api/admin/users/:id
exports.deleteUser = catchAsync(async (req, res, next) => {
  const user = await User.findByIdAndDelete(req.params.id);
  if (!user) return next(new AppError('User not found.', 404));
  res.status(200).json({ success: true, message: 'User deleted' });
});

// @desc    Revenue report (date range)
// @route   GET /api/admin/reports/revenue?from=&to=
exports.getRevenueReport = catchAsync(async (req, res) => {
  const { from, to } = req.query;
  const match = { status: 'success' };
  if (from || to) {
    match.createdAt = {};
    if (from) match.createdAt.$gte = new Date(from);
    if (to) match.createdAt.$lte = new Date(to);
  }

  const report = await Payment.aggregate([
    { $match: match },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
        totalRevenue: { $sum: '$amount' },
        transactions: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  res.status(200).json({ success: true, report });
});

// @desc    Export bookings as CSV
// @route   GET /api/admin/export/bookings
exports.exportBookingsCSV = catchAsync(async (req, res) => {
  const bookings = await Booking.find()
    .populate('user', 'firstName lastName email')
    .populate('workspace', 'name city')
    .lean();

  const rows = bookings.map((b) => ({
    bookingId: b.bookingId,
    customer: `${b.user?.firstName || ''} ${b.user?.lastName || ''}`,
    email: b.user?.email,
    workspace: b.workspace?.name,
    city: b.city,
    date: b.date,
    timeSlot: b.timeSlot,
    quantity: b.quantity,
    total: b.total,
    status: b.status,
    paymentStatus: b.paymentStatus,
    createdAt: b.createdAt,
  }));

  const parser = new Parser();
  const csv = parser.parse(rows);

  res.header('Content-Type', 'text/csv');
  res.attachment(`bookings-export-${Date.now()}.csv`);
  res.send(csv);
});

// @desc    Export users as CSV
// @route   GET /api/admin/export/users
exports.exportUsersCSV = catchAsync(async (req, res) => {
  const users = await User.find({ role: 'user' }).lean();
  const rows = users.map((u) => ({
    name: `${u.firstName} ${u.lastName}`,
    email: u.email,
    phone: u.phone,
    verified: u.isEmailVerified,
    active: u.isActive,
    joined: u.createdAt,
  }));

  const parser = new Parser();
  const csv = parser.parse(rows);

  res.header('Content-Type', 'text/csv');
  res.attachment(`users-export-${Date.now()}.csv`);
  res.send(csv);
});

// @desc    All payments (admin)
// @route   GET /api/admin/payments
exports.getAllPayments = catchAsync(async (req, res) => {
  const payments = await Payment.find().populate('user', 'firstName lastName email').populate('booking', 'bookingId').sort('-createdAt');
  res.status(200).json({ success: true, count: payments.length, payments });
});

// @desc    All reviews (admin, for moderation)
// @route   GET /api/admin/reviews
exports.getAllReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find().populate('user', 'firstName lastName').populate('workspace', 'name').sort('-createdAt');
  res.status(200).json({ success: true, count: reviews.length, reviews });
});
