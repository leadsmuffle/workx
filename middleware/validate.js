const validator = require('validator');
const AppError = require('../utils/AppError');

/**
 * Lightweight request validator. Pass a rules object describing each field:
 *   { email: { required: true, isEmail: true }, password: { required: true, minLength: 8 } }
 * Keeps the project dependency-light (no express-validator) while still
 * centralizing validation logic instead of scattering checks in controllers.
 */
const validate = (rules) => (req, res, next) => {
  const errors = [];

  Object.entries(rules).forEach(([field, rule]) => {
    const value = req.body[field];

    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${field} is required`);
      return;
    }
    if (value === undefined || value === null || value === '') return;

    if (rule.isEmail && !validator.isEmail(String(value))) {
      errors.push(`${field} must be a valid email`);
    }
    if (rule.minLength && String(value).length < rule.minLength) {
      errors.push(`${field} must be at least ${rule.minLength} characters`);
    }
    if (rule.isNumeric && !validator.isNumeric(String(value))) {
      errors.push(`${field} must be a number`);
    }
    if (rule.isMongoId && !validator.isMongoId(String(value))) {
      errors.push(`${field} must be a valid id`);
    }
  });

  if (errors.length > 0) {
    return next(new AppError(errors.join(', '), 400));
  }
  next();
};

module.exports = validate;
