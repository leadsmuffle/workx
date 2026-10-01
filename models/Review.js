const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    workspace: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    booking: { type: mongoose.Schema.Types.ObjectId, ref: 'Booking' }, // optional: only verified bookers
    rating: { type: Number, required: true, min: 1, max: 5 },
    comment: { type: String, required: true, trim: true, maxlength: 1000 },
  },
  { timestamps: true }
);

// One review per user per workspace
reviewSchema.index({ user: 1, workspace: 1 }, { unique: true });

// Recalculate the parent workspace's rating/numReviews whenever reviews change
reviewSchema.statics.recalcWorkspaceRating = async function (workspaceId) {
  const Workspace = mongoose.model('Workspace');
  const stats = await this.aggregate([
    { $match: { workspace: workspaceId } },
    { $group: { _id: '$workspace', avgRating: { $avg: '$rating' }, count: { $sum: 1 } } },
  ]);

  if (stats.length > 0) {
    await Workspace.findByIdAndUpdate(workspaceId, {
      rating: Math.round(stats[0].avgRating * 10) / 10,
      numReviews: stats[0].count,
    });
  } else {
    await Workspace.findByIdAndUpdate(workspaceId, { rating: 0, numReviews: 0 });
  }
};

reviewSchema.post('save', function () {
  this.constructor.recalcWorkspaceRating(this.workspace);
});

reviewSchema.post('findOneAndDelete', function (doc) {
  if (doc) doc.constructor.recalcWorkspaceRating(doc.workspace);
});

module.exports = mongoose.model('Review', reviewSchema);
