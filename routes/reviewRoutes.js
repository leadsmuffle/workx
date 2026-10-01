const express = require('express');
const router = express.Router();
const { getWorkspaceReviews, createReview, updateReview, deleteReview } = require('../controllers/reviewController');
const { protect } = require('../middleware/auth');

router.get('/workspace/:workspaceId', getWorkspaceReviews); // public
router.post('/', protect, createReview);
router.patch('/:id', protect, updateReview);
router.delete('/:id', protect, deleteReview);

module.exports = router;
