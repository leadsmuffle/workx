const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const Booking = require('../models/Booking');
const Invoice = require('../models/Invoice');

// @desc    Get logged-in user's profile
// @route   GET /api/users/profile
exports.getProfile = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// @desc    Update profile (name, phone) — not email/password here
// @route   PATCH /api/users/profile
exports.updateProfile = catchAsync(async (req, res, next) => {
  const allowed = ['firstName', 'lastName', 'phone'];
  const updates = {};
  allowed.forEach((key) => {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  });

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  });

  res.status(200).json({ success: true, message: 'Profile updated', user });
});

// @desc    Upload/replace profile picture
// @route   POST /api/users/profile/picture
exports.uploadProfilePicture = catchAsync(async (req, res, next) => {
  if (!req.file) return next(new AppError('Please upload an image file.', 400));

  const relativePath = `/uploads/profiles/${req.file.filename}`;
  const user = await User.findByIdAndUpdate(
    req.user._id,
    { profilePicture: relativePath },
    { new: true }
  );

  res.status(200).json({ success: true, message: 'Profile picture updated', user });
});

// @desc    Get logged-in user's booking history
// @route   GET /api/users/bookings
exports.getMyBookings = catchAsync(async (req, res) => {
  const { status } = req.query;
  const filter = { user: req.user._id };
  if (status) filter.status = status;

  const bookings = await Booking.find(filter)
    .populate('workspace', 'name type city images')
    .sort('-createdAt');

  res.status(200).json({ success: true, count: bookings.length, bookings });
});

// @desc    Get a single booking (must belong to the logged-in user)
// @route   GET /api/users/bookings/:id
exports.getMyBookingById = catchAsync(async (req, res, next) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id })
    .populate('workspace')
    .populate('invoice')
    .populate('payment');

  if (!booking) return next(new AppError('Booking not found.', 404));
  res.status(200).json({ success: true, booking });
});

// @desc    Download invoice PDF for one of the user's own bookings
// @route   GET /api/users/bookings/:id/invoice
exports.downloadMyInvoice = catchAsync(async (req, res, next) => {
  const booking = await Booking.findOne({ _id: req.params.id, user: req.user._id }).populate('invoice');
  if (!booking || !booking.invoice) return next(new AppError('Invoice not found.', 404));

  const path = require('path');
  const filePath = path.join(__dirname, '..', booking.invoice.pdfPath);
  res.download(filePath, `${booking.invoice.invoiceNumber}.pdf`);
});

// @desc    Get saved/favorite workspaces
// @route   GET /api/users/saved-workspaces
exports.getSavedWorkspaces = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id).populate('savedWorkspaces');
  res.status(200).json({ success: true, workspaces: user.savedWorkspaces });
});

// @desc    Toggle save/unsave a workspace
// @route   POST /api/users/saved-workspaces/:workspaceId
exports.toggleSavedWorkspace = catchAsync(async (req, res) => {
  const user = await User.findById(req.user._id);
  const idx = user.savedWorkspaces.findIndex((id) => id.toString() === req.params.workspaceId);

  if (idx > -1) {
    user.savedWorkspaces.splice(idx, 1);
  } else {
    user.savedWorkspaces.push(req.params.workspaceId);
  }
  await user.save();

  res.status(200).json({ success: true, saved: idx === -1, savedWorkspaces: user.savedWorkspaces });
});

// @desc    Deactivate own account
// @route   DELETE /api/users/profile
exports.deactivateAccount = catchAsync(async (req, res) => {
  await User.findByIdAndUpdate(req.user._id, { isActive: false });
  res.cookie('token', 'loggedout', { expires: new Date(Date.now() + 1000) });
  res.status(200).json({ success: true, message: 'Account deactivated.' });
});
