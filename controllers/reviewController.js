const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Review = require('../models/Review');
const Booking = require('../models/Booking');

// @desc    Get all reviews for a workspace
// @route   GET /api/reviews/workspace/:workspaceId
exports.getWorkspaceReviews = catchAsync(async (req, res) => {
  const reviews = await Review.find({ workspace: req.params.workspaceId })
    .populate('user', 'firstName lastName profilePicture')
    .sort('-createdAt');

  res.status(200).json({ success: true, count: reviews.length, reviews });
});

// @desc    Create a review (only for a workspace the user has actually booked)
// @route   POST /api/reviews
exports.createReview = catchAsync(async (req, res, next) => {
  const { workspaceId, rating, comment } = req.body;

  const hasBooked = await Booking.findOne({
    user: req.user._id,
    workspace: workspaceId,
    status: { $in: ['confirmed', 'completed'] },
  });
  if (!hasBooked) return next(new AppError('You can only review workspaces you have booked.', 403));

  const existing = await Review.findOne({ user: req.user._id, workspace: workspaceId });
  if (existing) return next(new AppError('You have already reviewed this workspace. You can edit your review instead.', 400));

  const review = await Review.create({
    user: req.user._id,
    workspace: workspaceId,
    booking: hasBooked._id,
    rating,
    comment,
  });

  res.status(201).json({ success: true, message: 'Review submitted', review });
});

// @desc    Edit own review
// @route   PATCH /api/reviews/:id
exports.updateReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError('Review not found.', 404));
  if (review.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only edit your own review.', 403));
  }

  if (req.body.rating) review.rating = req.body.rating;
  if (req.body.comment) review.comment = req.body.comment;
  await review.save();

  res.status(200).json({ success: true, message: 'Review updated', review });
});

// @desc    Delete own review (or admin can delete any)
// @route   DELETE /api/reviews/:id
exports.deleteReview = catchAsync(async (req, res, next) => {
  const review = await Review.findById(req.params.id);
  if (!review) return next(new AppError('Review not found.', 404));

  if (req.user.role !== 'admin' && review.user.toString() !== req.user._id.toString()) {
    return next(new AppError('You can only delete your own review.', 403));
  }

  await Review.findOneAndDelete({ _id: review._id }); // triggers post-hook to recalc workspace rating

  res.status(200).json({ success: true, message: 'Review deleted' });
});
