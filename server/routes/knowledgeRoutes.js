const express = require('express');
const multer = require('multer');
const {
  uploadDocument,
  getDocuments,
  deleteDocument,
} = require('../controllers/knowledgeController');

const router = express.Router();

// Store uploaded files in memory so we can extract text directly without disk clutter
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max file size
  },
  fileFilter: (req, file, cb) => {
    const name = file.originalname.toLowerCase();
    if (
      name.endsWith('.pdf') ||
      name.endsWith('.txt') ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'text/plain'
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only .pdf and .txt files are allowed.'));
    }
  },
});

router.post('/upload', upload.single('file'), uploadDocument);
router.get('/', getDocuments);
router.delete('/:id', deleteDocument);

module.exports = router;
