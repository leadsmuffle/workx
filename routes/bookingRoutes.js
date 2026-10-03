const express = require('express');
const router = express.Router();
const {
  createBooking, getBooking, cancelBooking, rescheduleBooking, getAllBookings, cleanupExpiredBookings,
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/auth');

// Vercel Cron (and manual/local triggers) hit this with a secret, not a user
// JWT, so it's registered BEFORE router.use(protect) below and checks
// CRON_SECRET itself instead. Vercel automatically sends
// `Authorization: Bearer <CRON_SECRET>` for configured cron routes; the
// x-cron-secret header is accepted too for manual/local testing.
const requireCronSecret = (req, res, next) => {
  const provided = (req.headers.authorization || '').replace(/^Bearer\s+/i, '') || req.headers['x-cron-secret'];
  if (!process.env.CRON_SECRET || provided !== process.env.CRON_SECRET) {
    return res.status(401).json({ success: false, message: 'Unauthorized' });
  }
  next();
};
router.get('/cron/cleanup-expired', requireCronSecret, cleanupExpiredBookings);

router.use(protect);

router.post('/', createBooking);
router.get('/', restrictTo('admin'), getAllBookings);
router.get('/:id', getBooking);
router.patch('/:id/cancel', cancelBooking);
router.patch('/:id/reschedule', rescheduleBooking);

module.exports = router;
