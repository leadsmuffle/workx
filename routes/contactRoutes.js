const express = require('express');
const router = express.Router();
const rateLimit = require('express-rate-limit');
const { submitContact, getAllContacts, updateContactStatus } = require('../controllers/contactController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Tighter than the global API rate limiter — basic protection against spam
// bots and accidental rapid-fire duplicate submissions from the same visitor.
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many submissions. Please try again in a few minutes.' },
});

router.post(
  '/',
  contactLimiter,
  validate({
    firstName: { required: true },
    lastName: { required: true },
    email: { required: true, isEmail: true },
  }),
  submitContact
);

router.get('/', protect, restrictTo('admin'), getAllContacts);
router.patch('/:id', protect, restrictTo('admin'), updateContactStatus);

module.exports = router;
