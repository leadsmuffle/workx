const express = require('express');
const router = express.Router();
const {
  getDashboardStats, getUsers, updateUser, deleteUser, getRevenueReport,
  exportBookingsCSV, exportUsersCSV, getAllPayments, getAllReviews,
} = require('../controllers/adminController');
const { getAllBookings } = require('../controllers/bookingController');
const { protect, restrictTo } = require('../middleware/auth');

router.use(protect, restrictTo('admin')); // every admin route requires an authenticated admin

router.get('/stats', getDashboardStats);

router.get('/users', getUsers);
router.patch('/users/:id', updateUser);
router.delete('/users/:id', deleteUser);

router.get('/bookings', getAllBookings);
router.get('/payments', getAllPayments);
router.get('/reviews', getAllReviews);

router.get('/reports/revenue', getRevenueReport);
router.get('/export/bookings', exportBookingsCSV);
router.get('/export/users', exportUsersCSV);

module.exports = router;
