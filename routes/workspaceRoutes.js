const express = require('express');
const router = express.Router();
const {
  getWorkspaces, getFeatured, getWorkspace, createWorkspace,
  updateWorkspace, deleteWorkspace, getCities,
} = require('../controllers/workspaceController');
const { protect, restrictTo } = require('../middleware/auth');
const { uploadWorkspaceImages } = require('../middleware/upload');

// Public
router.get('/', getWorkspaces);
router.get('/featured', getFeatured);
router.get('/meta/cities', getCities);
router.get('/:id', getWorkspace);

// Admin only
router.post('/', protect, restrictTo('admin'), uploadWorkspaceImages, createWorkspace);
router.patch('/:id', protect, restrictTo('admin'), uploadWorkspaceImages, updateWorkspace);
router.delete('/:id', protect, restrictTo('admin'), deleteWorkspace);

module.exports = router;
