const express = require('express');
const router = express.Router();
const { getSeatMap, lockSeats, unlockSeats } = require('../controllers/seatController');
const { protect } = require('../middleware/auth');

router.get('/:workspaceId', getSeatMap); // public — anyone can view live availability
router.post('/lock', protect, lockSeats);
router.post('/unlock', protect, unlockSeats);

module.exports = router;
