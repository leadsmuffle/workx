const express = require('express');
const router = express.Router();
const {
  createBooking, getBooking, cancelBooking, rescheduleBooking, getAllBookings,
} = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect);

router.post('/', createBooking);
router.get('/', restrictTo('admin'), getAllBookings);
router.get('/:id', getBooking);
router.patch('/:id/cancel', cancelBooking);
router.patch('/:id/reschedule', rescheduleBooking);

module.exports = router;
