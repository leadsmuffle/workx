/**
 * Custom operational error class.
 * Any error thrown with AppError is a "known" error (bad input, not found, etc.)
 * as opposed to an unexpected programming/bug error.
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
