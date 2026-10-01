const express = require('express');
const router = express.Router();
const {
  createStripeIntent, stripeWebhook, initiateJazzCash, jazzCashCallback,
  initiateEasyPaisa, easyPaisaCallback, getMyPaymentHistory,
} = require('../controllers/paymentController');
const { protect } = require('../middleware/auth');

// NOTE: the Stripe webhook route is mounted with express.raw() in server.js
// (must run BEFORE the global express.json() body parser), so it is NOT declared here.

router.post('/stripe/create-intent', protect, createStripeIntent);

router.post('/jazzcash/initiate', protect, initiateJazzCash);
router.post('/jazzcash/callback', jazzCashCallback); // called server-to-server by JazzCash, no auth

router.post('/easypaisa/initiate', protect, initiateEasyPaisa);
router.post('/easypaisa/callback', easyPaisaCallback); // called server-to-server by EasyPaisa, no auth

router.get('/my-history', protect, getMyPaymentHistory);

module.exports = router;
