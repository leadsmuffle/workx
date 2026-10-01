const express = require('express');
const router = express.Router();
const { submitContact, getAllContacts, updateContactStatus } = require('../controllers/contactController');
const { protect, restrictTo } = require('../middleware/auth');
const validate = require('../middleware/validate');

router.post(
  '/',
  validate({
    firstName: { required: true },
    lastName: { required: true },
    email: { required: true, isEmail: true },
    message: { required: true },
  }),
  submitContact
);

router.get('/', protect, restrictTo('admin'), getAllContacts);
router.patch('/:id', protect, restrictTo('admin'), updateContactStatus);

module.exports = router;
