const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const cloudinary = require('../config/cloudinary');

const MAX_FILE_SIZE_BYTES = 200 * 1024; // 200 KB, per requirement

const storage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: 'election-system',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf'],
  },
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'application/pdf'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Only JPG, PNG, or PDF files are allowed.'));
    }
    cb(null, true);
  },
});

module.exports = upload;
