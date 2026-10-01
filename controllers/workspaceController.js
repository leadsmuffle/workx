const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Workspace = require('../models/Workspace');
const Seat = require('../models/Seat');

// @desc    Get all workspaces (public) — supports search & filters
// @route   GET /api/workspaces?city=&type=&minPrice=&maxPrice=&capacity=&search=
exports.getWorkspaces = catchAsync(async (req, res) => {
  const { city, type, minPrice, maxPrice, capacity, search, sort, page = 1, limit = 12 } = req.query;

  const filter = { status: 'active' };
  if (city) filter.city = new RegExp(`^${city}$`, 'i');
  if (type) filter.type = type;
  if (capacity) filter.capacity = { $gte: Number(capacity) };
  if (minPrice || maxPrice) {
    filter.pricePerDay = {};
    if (minPrice) filter.pricePerDay.$gte = Number(minPrice);
    if (maxPrice) filter.pricePerDay.$lte = Number(maxPrice);
  }
  if (search) {
    filter.$or = [
      { name: new RegExp(search, 'i') },
      { city: new RegExp(search, 'i') },
      { description: new RegExp(search, 'i') },
    ];
  }

  const sortMap = {
    price_asc: 'pricePerDay',
    price_desc: '-pricePerDay',
    rating: '-rating',
    newest: '-createdAt',
  };

  const skip = (Number(page) - 1) * Number(limit);

  const [workspaces, total] = await Promise.all([
    Workspace.find(filter).sort(sortMap[sort] || '-createdAt').skip(skip).limit(Number(limit)),
    Workspace.countDocuments(filter),
  ]);

  res.status(200).json({
    success: true,
    count: workspaces.length,
    total,
    page: Number(page),
    pages: Math.ceil(total / Number(limit)),
    workspaces,
  });
});

// @desc    Get featured workspaces
// @route   GET /api/workspaces/featured
exports.getFeatured = catchAsync(async (req, res) => {
  const workspaces = await Workspace.find({ status: 'active', isFeatured: true }).limit(6);
  res.status(200).json({ success: true, workspaces });
});

// @desc    Get single workspace (with its seat map)
// @route   GET /api/workspaces/:id
exports.getWorkspace = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findById(req.params.id);
  if (!workspace) return next(new AppError('Workspace not found.', 404));

  const seats = await Seat.find({ workspace: workspace._id }).sort('row col');

  res.status(200).json({ success: true, workspace, seats });
});

// @desc    Create workspace (admin)
// @route   POST /api/workspaces
exports.createWorkspace = catchAsync(async (req, res, next) => {
  const body = { ...req.body, createdBy: req.user._id };

  if (typeof body.amenities === 'string') body.amenities = body.amenities.split(',').map((a) => a.trim());

  if (req.files && req.files.length > 0) {
    body.images = req.files.map((f) => `/uploads/workspaces/${f.filename}`);
  }

  const workspace = await Workspace.create(body);

  // Auto-generate seat records based on `capacity` (simple grid layout)
  const seatDocs = [];
  const cols = 8;
  for (let i = 0; i < workspace.capacity; i++) {
    seatDocs.push({
      workspace: workspace._id,
      seatNumber: `S${i + 1}`,
      row: Math.floor(i / cols),
      col: i % cols,
    });
  }
  if (seatDocs.length > 0) await Seat.insertMany(seatDocs);

  res.status(201).json({ success: true, message: 'Workspace created', workspace });
});

// @desc    Update workspace (admin)
// @route   PATCH /api/workspaces/:id
exports.updateWorkspace = catchAsync(async (req, res, next) => {
  const body = { ...req.body };
  if (typeof body.amenities === 'string') body.amenities = body.amenities.split(',').map((a) => a.trim());

  if (req.files && req.files.length > 0) {
    body.images = req.files.map((f) => `/uploads/workspaces/${f.filename}`);
  }

  const workspace = await Workspace.findByIdAndUpdate(req.params.id, body, {
    new: true,
    runValidators: true,
  });

  if (!workspace) return next(new AppError('Workspace not found.', 404));
  res.status(200).json({ success: true, message: 'Workspace updated', workspace });
});

// @desc    Delete workspace (admin)
// @route   DELETE /api/workspaces/:id
exports.deleteWorkspace = catchAsync(async (req, res, next) => {
  const workspace = await Workspace.findByIdAndDelete(req.params.id);
  if (!workspace) return next(new AppError('Workspace not found.', 404));

  await Seat.deleteMany({ workspace: workspace._id });

  res.status(200).json({ success: true, message: 'Workspace deleted' });
});

// @desc    Get distinct list of cities (for search filters)
// @route   GET /api/workspaces/meta/cities
exports.getCities = catchAsync(async (req, res) => {
  const cities = await Workspace.distinct('city', { status: 'active' });
  res.status(200).json({ success: true, cities });
});
