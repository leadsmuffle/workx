/**
 * Wraps an async controller/middleware function so any rejected promise
 * is automatically forwarded to Express's error-handling middleware,
 * removing the need for try/catch in every controller.
 */
module.exports = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
