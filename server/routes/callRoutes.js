const express = require('express');
const { createCall, getCalls, getCallById } = require('../controllers/callController');

const router = express.Router();

router.post('/', createCall);
router.get('/', getCalls);
router.get('/:id', getCallById);

module.exports = router;
