const express = require('express');
const router = express.Router();
const { downloadInvoice, emailInvoice } = require('../controllers/invoiceController');
const { protect } = require('../middleware/auth');

router.use(protect);
router.get('/:id/download', downloadInvoice);
router.post('/:id/email', emailInvoice);

module.exports = router;
