const catchAsync = require('../utils/catchAsync');
const Notification = require('../models/Notification');

// @desc    Get logged-in user's notifications
// @route   GET /api/notifications
exports.getMyNotifications = catchAsync(async (req, res) => {
  const filter = req.user.role === 'admin' ? { forAdmin: true } : { user: req.user._id };
  const notifications = await Notification.find(filter).sort('-createdAt').limit(50);
  const unreadCount = await Notification.countDocuments({ ...filter, isRead: false });

  res.status(200).json({ success: true, unreadCount, notifications });
});

// @desc    Mark one notification as read
// @route   PATCH /api/notifications/:id/read
exports.markAsRead = catchAsync(async (req, res) => {
  const notification = await Notification.findByIdAndUpdate(req.params.id, { isRead: true }, { new: true });
  res.status(200).json({ success: true, notification });
});

// @desc    Mark all as read
// @route   PATCH /api/notifications/read-all
exports.markAllAsRead = catchAsync(async (req, res) => {
  const filter = req.user.role === 'admin' ? { forAdmin: true } : { user: req.user._id };
  await Notification.updateMany(filter, { isRead: true });
  res.status(200).json({ success: true, message: 'All notifications marked as read.' });
});
