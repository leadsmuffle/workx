const path = require('path');
const dotenv = require('dotenv');
dotenv.config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const xss = require('xss-clean');
const hpp = require('hpp');
const cookieParser = require('cookie-parser');
const morgan = require('morgan');
const compression = require('compression');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/error');
const AppError = require('./utils/AppError');
const { stripeWebhook } = require('./controllers/paymentController');

const app = express();

// ---------------------------------------------------------
// Security middleware
// ---------------------------------------------------------
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Frontend uses inline <script>/<style> blocks — allow those from our own pages.
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        // Workspace photos are loaded from Unsplash; also allow data: URIs (base64 images/QR codes).
        imgSrc: ["'self'", 'data:', 'https://images.unsplash.com'],
        connectSrc: ["'self'"],
        // Contact section embeds a Google Maps location iframe.
        frameSrc: ["'self'", 'https://www.google.com'],
      },
    },
  })
);
app.use(cors({ origin: process.env.CLIENT_URL || true, credentials: true }));
app.set('trust proxy', 1);

// ---------------------------------------------------------
// Database — ensure the (cached) connection is established before any /api
// request is handled. Critical on serverless (Vercel), where the module can
// run on a fresh cold start with no connection yet; connectDB() returns the
// same cached promise on every warm invocation, so this resolves instantly
// after the first request.
// ---------------------------------------------------------
app.use('/api', (req, res, next) => {
  connectDB()
    .then(() => next())
    .catch(() => next(new AppError('Database connection failed. Please try again shortly.', 500)));
});

const globalLimiter = rateLimit({
  windowMs: (Number(process.env.RATE_LIMIT_WINDOW_MINUTES) || 15) * 60 * 1000,
  max: Number(process.env.RATE_LIMIT_MAX_REQUESTS) || 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please slow down.' },
});
app.use('/api', globalLimiter);

// ---------------------------------------------------------
// Stripe webhook needs the RAW body (must be registered BEFORE express.json())
// ---------------------------------------------------------
app.post('/api/payments/stripe/webhook', express.raw({ type: 'application/json' }), stripeWebhook);

// ---------------------------------------------------------
// Body parsing + sanitization
// ---------------------------------------------------------
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser());
app.use(mongoSanitize()); // strips $ and . from req.body/query/params (NoSQL injection protection)
app.use(xss()); // sanitizes user input from malicious HTML/JS (XSS protection)
app.use(hpp()); // prevents HTTP parameter pollution
app.use(compression());

if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// ---------------------------------------------------------
// Static files (uploaded images, invoices, and the frontend build)
// ---------------------------------------------------------
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// extensions:['html'] lets clean URLs like /about resolve to public/about.html
// directly (frontend links no longer include .html — see each page's nav/footer).
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

// ---------------------------------------------------------
// API Routes
// ---------------------------------------------------------
app.use('/api/auth', require('./routes/authRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/workspaces', require('./routes/workspaceRoutes'));
app.use('/api/seats', require('./routes/seatRoutes'));
app.use('/api/bookings', require('./routes/bookingRoutes'));
app.use('/api/payments', require('./routes/paymentRoutes'));
app.use('/api/invoices', require('./routes/invoiceRoutes'));
app.use('/api/reviews', require('./routes/reviewRoutes'));
app.use('/api/contact', require('./routes/contactRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/notifications', require('./routes/notificationRoutes'));

app.get('/api/health', (req, res) => res.status(200).json({ success: true, message: 'WorkX API is running' }));

// Serve the frontend for any non-API route (SPA-style fallback)
app.get('*', (req, res, next) => {
  if (req.originalUrl.startsWith('/api')) return next(new AppError(`Route ${req.originalUrl} not found`, 404));
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ---------------------------------------------------------
// Global error handler (must be last)
// ---------------------------------------------------------
app.use(errorHandler);

// ---------------------------------------------------------
// Stale (unpaid) bookings are now expired lazily — see expireStaleBookings()
// calls inside bookingController.js (createBooking / getAllBookings) — plus
// a daily backup cleanup via the CRON_SECRET-protected route wired in
// bookingRoutes.js + the Vercel Cron entry in vercel.json. A setInterval
// here would not survive serverless cold starts/restarts, so it's gone.
// ---------------------------------------------------------

// ---------------------------------------------------------
// Start server — only when actually running as a long-lived process
// (local dev, or a traditional host like Render). On Vercel the exported
// `app` is invoked per-request by the platform, so app.listen() must not
// run there (Vercel sets VERCEL=1 in its build/runtime environment).
// ---------------------------------------------------------
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;
  const server = app.listen(PORT, () => {
    console.log(`WorkX API running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  });

  // Safety net for unhandled promise rejections (e.g. a bad DB query outside try/catch)
  process.on('unhandledRejection', (err) => {
    console.error('UNHANDLED REJECTION! Shutting down...', err.name, err.message);
    server.close(() => process.exit(1));
  });
}

module.exports = app;
