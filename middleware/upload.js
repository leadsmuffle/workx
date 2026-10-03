const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');
const { uploadToBlob } = require('../utils/blobStorage');

/**
 * Multer keeps uploads in memory (file.buffer) instead of writing to local
 * disk — Vercel's filesystem isn't persistent. Controllers then push that
 * buffer to Vercel Blob via uploadFileToBlob() below. Same field names, size
 * limit, and file-type validation as before.
 */
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) return cb(null, true);
  cb(new AppError('Only JPG, PNG, and WEBP images are allowed.', 400), false);
};

const makeUploader = () =>
  multer({ storage: multer.memoryStorage(), fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB

exports.uploadProfilePicture = makeUploader().single('profilePicture');
exports.uploadWorkspaceImages = makeUploader().array('images', 8);

/**
 * Uploads a single multer in-memory file (from req.file / req.files[i]) to
 * Vercel Blob under destFolder, and returns its public URL.
 */
exports.uploadFileToBlob = async (file, destFolder) => {
  const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  const pathname = `${destFolder}/${unique}${path.extname(file.originalname)}`;
  return uploadToBlob(pathname, file.buffer, file.mimetype);
};
