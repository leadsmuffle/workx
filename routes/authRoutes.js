const express = require('express');
const rateLimit = require('express-rate-limit');
const router = express.Router();
const {
  register, login, logout, getMe, verifyEmail, resendVerification,
  forgotPassword, resetPassword, changePassword,
} = require('../controllers/authController');
const { protect } = require('../middleware/auth');
const validate = require('../middleware/validate');

// Stricter limiter for auth endpoints to slow down brute-force / credential stuffing
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { success: false, message: 'Too many attempts. Please try again later.' },
});

router.post(
  '/register',
  authLimiter,
  validate({
    firstName: { required: true },
    lastName: { required: true },
    email: { required: true, isEmail: true },
    password: { required: true, minLength: 8 },
  }),
  register
);

router.post('/login', authLimiter, validate({ email: { required: true, isEmail: true }, password: { required: true } }), login);
router.post('/logout', logout);
router.get('/me', protect, getMe);

router.get('/verify-email/:token', verifyEmail);
router.post('/resend-verification', authLimiter, validate({ email: { required: true, isEmail: true } }), resendVerification);

router.post('/forgot-password', authLimiter, validate({ email: { required: true, isEmail: true } }), forgotPassword);
router.patch('/reset-password/:token', validate({ password: { required: true, minLength: 8 } }), resetPassword);
router.patch(
  '/change-password',
  protect,
  validate({ currentPassword: { required: true }, newPassword: { required: true, minLength: 8 } }),
  changePassword
);

module.exports = router;
