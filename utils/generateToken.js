const jwt = require('jsonwebtoken');

/**
 * Signs a JWT for a given user id and role.
 * @param {String} id - Mongo user _id
 * @param {String} role - 'user' | 'admin'
 * @param {Boolean} rememberMe - if true, issues a long-lived token
 */
const generateToken = (id, role = 'user', rememberMe = false) => {
  const expiresIn = rememberMe
    ? process.env.JWT_REMEMBER_ME_EXPIRES_IN || '30d'
    : process.env.JWT_EXPIRES_IN || '7d';

  return jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn });
};

/**
 * Sets the JWT as an httpOnly cookie AND returns it in the JSON body,
 * so the frontend can use either cookie-based or header-based auth.
 */
const sendTokenResponse = (user, statusCode, res, rememberMe = false) => {
  const token = generateToken(user._id, user.role, rememberMe);

  const days = rememberMe
    ? 30
    : Number(process.env.JWT_COOKIE_EXPIRES_DAYS || 7);

  const cookieOptions = {
    expires: new Date(Date.now() + days * 24 * 60 * 60 * 1000),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  };

  user.password = undefined;

  res.status(statusCode).cookie('token', token, cookieOptions).json({
    success: true,
    token,
    user,
  });
};

module.exports = { generateToken, sendTokenResponse };
