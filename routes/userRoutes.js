const express = require('express');
const router = express.Router();
const {
  getProfile, updateProfile, uploadProfilePicture, getMyBookings,
  getMyBookingById, downloadMyInvoice, getSavedWorkspaces,
  toggleSavedWorkspace, deactivateAccount,
} = require('../controllers/userController');
const { protect } = require('../middleware/auth');
const { uploadProfilePicture: uploadMiddleware } = require('../middleware/upload');

router.use(protect); // every route below requires a logged-in user

router.get('/profile', getProfile);
router.patch('/profile', updateProfile);
router.delete('/profile', deactivateAccount);
router.post('/profile/picture', uploadMiddleware, uploadProfilePicture);

router.get('/bookings', getMyBookings);
router.get('/bookings/:id', getMyBookingById);
router.get('/bookings/:id/invoice', downloadMyInvoice);

router.get('/saved-workspaces', getSavedWorkspaces);
router.post('/saved-workspaces/:workspaceId', toggleSavedWorkspace);

module.exports = router;
