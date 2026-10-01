const crypto = require('crypto');
const Stripe = require('stripe');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const Booking = require('../models/Booking');
const Seat = require('../models/Seat');
const Payment = require('../models/Payment');
const User = require('../models/User');
const Workspace = require('../models/Workspace');
const Notification = require('../models/Notification');
const { createAndSendInvoice } = require('../utils/invoiceService');
const sendEmail = require('../utils/sendEmail');
const { paymentSuccessTemplate } = require('../utils/emailTemplates');

const stripe = process.env.STRIPE_SECRET_KEY ? Stripe(process.env.STRIPE_SECRET_KEY) : null;

/**
 * Shared "on payment success" logic used by all three gateways:
 * confirms the booking, marks the seats as permanently booked (not just
 * locked), generates + emails the invoice, and notifies the user + admin.
 */
const finalizeSuccessfulPayment = async ({ booking, method, amount, transactionId, gatewayResponse }) => {
  const payment = await Payment.create({
    booking: booking._id,
    user: booking.user,
    method,
    amount,
    status: 'success',
    transactionId,
    gatewayResponse,
  });

  booking.status = 'confirmed';
  booking.paymentStatus = 'paid';
  booking.payment = payment._id;
  await booking.save();

  // Convert seat locks -> permanent bookings
  const seatIds = booking.seats.map((s) => s.seat);
  await Seat.updateMany(
    { _id: { $in: seatIds }, 'bookedSlots.booking': booking._id },
    { $set: { 'bookedSlots.$.status': 'booked' } }
  );

  const [user, workspace] = await Promise.all([
    User.findById(booking.user),
    Workspace.findById(booking.workspace),
  ]);

  await createAndSendInvoice(booking, user, workspace);

  await sendEmail({
    to: user.email,
    subject: 'Payment received — WorkX',
    html: paymentSuccessTemplate(user.firstName, amount, booking.bookingId),
  }).catch((err) => console.error('Payment email failed:', err.message));

  await Notification.create({ user: user._id, type: 'payment', title: 'Payment successful', message: `Payment of PKR ${amount} received for booking ${booking.bookingId}.` });
  await Notification.create({ forAdmin: true, type: 'payment', title: 'Payment received', message: `PKR ${amount} received for booking ${booking.bookingId}.` });

  return payment;
};

// =========================================================
// STRIPE
// =========================================================

// @desc    Create a Stripe PaymentIntent for a booking
// @route   POST /api/payments/stripe/create-intent
exports.createStripeIntent = catchAsync(async (req, res, next) => {
  if (!stripe) return next(new AppError('Stripe is not configured on this server.', 500));

  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) return next(new AppError('Booking not found.', 404));
  if (booking.user.toString() !== req.user._id.toString()) return next(new AppError('Not authorized.', 403));
  if (booking.paymentStatus === 'paid') return next(new AppError('This booking is already paid.', 400));

  const intent = await stripe.paymentIntents.create({
    amount: booking.total * 100, // smallest currency unit
    currency: 'pkr',
    metadata: { bookingId: booking.bookingId, mongoBookingId: booking._id.toString() },
  });

  res.status(200).json({ success: true, clientSecret: intent.client_secret });
});

// @desc    Stripe webhook — the SOURCE OF TRUTH for payment success (not the frontend)
// @route   POST /api/payments/stripe/webhook
exports.stripeWebhook = catchAsync(async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object;
    const booking = await Booking.findById(intent.metadata.mongoBookingId);

    if (booking && booking.paymentStatus !== 'paid') {
      await finalizeSuccessfulPayment({
        booking,
        method: 'stripe',
        amount: intent.amount / 100,
        transactionId: intent.id,
        gatewayResponse: intent,
      });
    }
  }

  res.status(200).json({ received: true });
});

// =========================================================
// JAZZCASH (Mobile Wallet — Pakistan)
// Docs: https://sandbox.jazzcash.com.pk/
// JazzCash uses an HMAC-SHA256 "Secure Hash" built from sorted pp_ params.
// =========================================================

const buildJazzCashHash = (params) => {
  const sorted = Object.keys(params).filter((k) => params[k] !== '').sort();
  const combined = sorted.map((k) => params[k]).join('&');
  const stringToHash = `${process.env.JAZZCASH_INTEGRITY_SALT}&${combined}`;
  return crypto.createHmac('sha256', process.env.JAZZCASH_INTEGRITY_SALT).update(stringToHash).digest('hex');
};

// @desc    Build the JazzCash redirect payload for a booking
// @route   POST /api/payments/jazzcash/initiate
exports.initiateJazzCash = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) return next(new AppError('Booking not found.', 404));

  const now = new Date();
  const txnDateTime = now.toISOString().replace(/[-:T.]/g, '').slice(0, 14);
  const expiry = new Date(now.getTime() + 60 * 60 * 1000).toISOString().replace(/[-:T.]/g, '').slice(0, 14);

  const params = {
    pp_Version: '1.1',
    pp_TxnType: 'MWALLET',
    pp_Language: 'EN',
    pp_MerchantID: process.env.JAZZCASH_MERCHANT_ID,
    pp_Password: process.env.JAZZCASH_PASSWORD,
    pp_TxnRefNo: `T${booking.bookingId}`,
    pp_Amount: String(booking.total * 100),
    pp_TxnCurrency: 'PKR',
    pp_TxnDateTime: txnDateTime,
    pp_BillReference: booking.bookingId,
    pp_Description: `WorkX booking ${booking.bookingId}`,
    pp_TxnExpiryDateTime: expiry,
    pp_ReturnURL: process.env.JAZZCASH_RETURN_URL,
  };

  params.pp_SecureHash = buildJazzCashHash(params);

  res.status(200).json({ success: true, gatewayUrl: 'https://sandbox.jazzcash.com.pk/CustomerPortal/transactionmanagement/merchantform/', params });
});

// @desc    JazzCash server-to-server / redirect callback
// @route   POST /api/payments/jazzcash/callback
exports.jazzCashCallback = catchAsync(async (req, res) => {
  const { pp_ResponseCode, pp_BillReference, pp_Amount, pp_TxnRefNo } = req.body;

  const booking = await Booking.findOne({ bookingId: pp_BillReference });
  if (booking && pp_ResponseCode === '000' && booking.paymentStatus !== 'paid') {
    await finalizeSuccessfulPayment({
      booking,
      method: 'jazzcash',
      amount: Number(pp_Amount) / 100,
      transactionId: pp_TxnRefNo,
      gatewayResponse: req.body,
    });
  }

  res.status(200).json({ success: pp_ResponseCode === '000' });
});

// =========================================================
// EASYPAISA (Mobile Wallet — Pakistan)
// Docs: https://easypaisa.com.pk/ (merchant integration guide)
// EasyPaisa uses an HMAC-SHA256 hash over merchant params, similar pattern to JazzCash.
// =========================================================

const buildEasyPaisaHash = (params) => {
  const combined = Object.values(params).join('&');
  return crypto.createHmac('sha256', process.env.EASYPAISA_HASH_KEY).update(combined).digest('hex');
};

// @desc    Build the EasyPaisa redirect payload for a booking
// @route   POST /api/payments/easypaisa/initiate
exports.initiateEasyPaisa = catchAsync(async (req, res, next) => {
  const booking = await Booking.findById(req.body.bookingId);
  if (!booking) return next(new AppError('Booking not found.', 404));

  const params = {
    storeId: process.env.EASYPAISA_STORE_ID,
    amount: booking.total,
    postBackURL: process.env.EASYPAISA_RETURN_URL,
    orderRefNum: booking.bookingId,
    expiryDate: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    merchantHashedReq: '',
  };
  params.merchantHashedReq = buildEasyPaisaHash(params);

  res.status(200).json({ success: true, gatewayUrl: 'https://easypay.easypaisa.com.pk/easypay/Index.jsf', params });
});

// @desc    EasyPaisa callback
// @route   POST /api/payments/easypaisa/callback
exports.easyPaisaCallback = catchAsync(async (req, res) => {
  const { status, orderRefNum, amount, transactionId } = req.body;

  const booking = await Booking.findOne({ bookingId: orderRefNum });
  if (booking && status === 'SUCCESS' && booking.paymentStatus !== 'paid') {
    await finalizeSuccessfulPayment({
      booking, method: 'easypaisa', amount: Number(amount), transactionId, gatewayResponse: req.body,
    });
  }

  res.status(200).json({ success: status === 'SUCCESS' });
});

// @desc    Get logged-in user's payment history
// @route   GET /api/payments/my-history
exports.getMyPaymentHistory = catchAsync(async (req, res) => {
  const payments = await Payment.find({ user: req.user._id }).populate('booking').sort('-createdAt');
  res.status(200).json({ success: true, payments });
});

module.exports.finalizeSuccessfulPayment = finalizeSuccessfulPayment;
