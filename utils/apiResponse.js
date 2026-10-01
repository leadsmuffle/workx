/**
 * Standard success response shape used across all controllers.
 */
exports.sendSuccess = (res, statusCode, message, data = null, extra = {}) => {
  res.status(statusCode).json({
    success: true,
    message,
    data,
    ...extra,
  });
};
