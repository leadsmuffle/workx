const mongoose = require('mongoose');

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Workspace name is required'], trim: true },
    slug: { type: String, unique: true, lowercase: true },
    type: {
      type: String,
      enum: [
        'Hot Desk', 'Single Seat', 'Dedicated Desk', '2 Seater Office',
        '4 Seater Office', '8 Seater Team Office', 'Meeting Room',
        'Event Space', 'Private Cabin',
      ],
      required: true,
    },
    city: { type: String, required: true, trim: true },
    address: { type: String, required: true },
    description: { type: String, required: true },
    images: [{ type: String }],
    pricePerDay: { type: Number, required: true },
    pricePerHour: { type: Number },
    pricePerMonth: { type: Number },
    capacity: { type: Number, required: true, default: 1 },
    amenities: [{ type: String }], // e.g. WiFi, Coffee, AC, Parking, Printing...
    rating: { type: Number, default: 0 },
    numReviews: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'inactive', 'maintenance'], default: 'active' },
    isFeatured: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

workspaceSchema.index({ city: 1, type: 1, status: 1 });
workspaceSchema.index({ pricePerDay: 1 });

workspaceSchema.pre('save', function (next) {
  if (this.isModified('name')) {
    this.slug =
      this.name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now().toString().slice(-5);
  }
  next();
});

module.exports = mongoose.model('Workspace', workspaceSchema);
