const multer = require('multer');
const path = require('path');
const AppError = require('../utils/AppError');

/**
 * Generic multer factory. destFolder is relative to /uploads.
 */
const makeUploader = (destFolder) => {
  const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, path.join(__dirname, '..', 'uploads', destFolder)),
    filename: (req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname)}`);
    },
  });

  const fileFilter = (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new AppError('Only JPG, PNG, and WEBP images are allowed.', 400), false);
  };

  return multer({ storage, fileFilter, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB
};

exports.uploadProfilePicture = makeUploader('profiles').single('profilePicture');
exports.uploadWorkspaceImages = makeUploader('workspaces').array('images', 8);
