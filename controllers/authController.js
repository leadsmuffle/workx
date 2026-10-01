const crypto = require('crypto');
const catchAsync = require('../utils/catchAsync');
const AppError = require('../utils/AppError');
const User = require('../models/User');
const sendEmail = require('../utils/sendEmail');
const { verifyEmailTemplate, resetPasswordTemplate } = require('../utils/emailTemplates');
const { sendTokenResponse, generateToken } = require('../utils/generateToken');

// @desc    Register a new user
// @route   POST /api/auth/register
exports.register = catchAsync(async (req, res, next) => {
  const { firstName, lastName, email, password, phone } = req.body;

  const existing = await User.findOne({ email });
  if (existing) return next(new AppError('An account with this email already exists.', 400));

  const user = await User.create({ firstName, lastName, email, password, phone });

  // Generate + send email verification link
  const verifyToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Verify your WorkX account',
      html: verifyEmailTemplate(user.firstName, verifyUrl),
    });
  } catch (err) {
    // Registration should still succeed even if the email fails to send;
    // the user can request a new verification email later.
    console.error('Failed to send verification email:', err.message);
  }

  sendTokenResponse(user, 201, res, false);
});

// @desc    Login
// @route   POST /api/auth/login
exports.login = catchAsync(async (req, res, next) => {
  const { email, password, rememberMe } = req.body;

  if (!email || !password) return next(new AppError('Please provide email and password.', 400));

  const user = await User.findOne({ email }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    return next(new AppError('Incorrect email or password.', 401));
  }

  if (!user.isActive) return next(new AppError('This account has been deactivated.', 403));

  sendTokenResponse(user, 200, res, !!rememberMe);
});

// @desc    Logout — clears the auth cookie
// @route   POST /api/auth/logout
exports.logout = (req, res) => {
  res.cookie('token', 'loggedout', { expires: new Date(Date.now() + 1000), httpOnly: true });
  res.status(200).json({ success: true, message: 'Logged out successfully' });
};

// @desc    Get currently logged-in user
// @route   GET /api/auth/me
exports.getMe = catchAsync(async (req, res) => {
  res.status(200).json({ success: true, user: req.user });
});

// @desc    Verify email via token from the verification link
// @route   GET /api/auth/verify-email/:token
exports.verifyEmail = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    emailVerificationToken: hashedToken,
    emailVerificationExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('Verification link is invalid or has expired.', 400));

  user.isEmailVerified = true;
  user.emailVerificationToken = undefined;
  user.emailVerificationExpires = undefined;
  await user.save({ validateBeforeSave: false });

  res.status(200).json({ success: true, message: 'Email verified successfully. You can now log in.' });
});

// @desc    Resend verification email
// @route   POST /api/auth/resend-verification
exports.resendVerification = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('No account found with that email.', 404));
  if (user.isEmailVerified) return next(new AppError('This email is already verified.', 400));

  const verifyToken = user.generateEmailVerificationToken();
  await user.save({ validateBeforeSave: false });

  const verifyUrl = `${process.env.CLIENT_URL}/verify-email/${verifyToken}`;
  await sendEmail({
    to: user.email,
    subject: 'Verify your WorkX account',
    html: verifyEmailTemplate(user.firstName, verifyUrl),
  });

  res.status(200).json({ success: true, message: 'Verification email resent.' });
});

// @desc    Forgot password — sends a reset link
// @route   POST /api/auth/forgot-password
exports.forgotPassword = catchAsync(async (req, res, next) => {
  const user = await User.findOne({ email: req.body.email });
  if (!user) return next(new AppError('No account found with that email.', 404));

  const resetToken = user.generatePasswordResetToken();
  await user.save({ validateBeforeSave: false });

  const resetUrl = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;

  try {
    await sendEmail({
      to: user.email,
      subject: 'Reset your WorkX password (valid for 10 minutes)',
      html: resetPasswordTemplate(user.firstName, resetUrl),
    });
    res.status(200).json({ success: true, message: 'Password reset link sent to your email.' });
  } catch (err) {
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save({ validateBeforeSave: false });
    return next(new AppError('Failed to send reset email. Please try again later.', 500));
  }
});

// @desc    Reset password using the token from the email link
// @route   PATCH /api/auth/reset-password/:token
exports.resetPassword = catchAsync(async (req, res, next) => {
  const hashedToken = crypto.createHash('sha256').update(req.params.token).digest('hex');

  const user = await User.findOne({
    passwordResetToken: hashedToken,
    passwordResetExpires: { $gt: Date.now() },
  });

  if (!user) return next(new AppError('Reset link is invalid or has expired.', 400));

  user.password = req.body.password;
  user.passwordResetToken = undefined;
  user.passwordResetExpires = undefined;
  await user.save();

  sendTokenResponse(user, 200, res, false);
});

// @desc    Change password while logged in
// @route   PATCH /api/auth/change-password
exports.changePassword = catchAsync(async (req, res, next) => {
  const user = await User.findById(req.user._id).select('+password');

  if (!(await user.comparePassword(req.body.currentPassword))) {
    return next(new AppError('Current password is incorrect.', 401));
  }

  user.password = req.body.newPassword;
  await user.save();

  sendTokenResponse(user, 200, res, false);
});
