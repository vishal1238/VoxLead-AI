const express = require('express');
const { getLeads, getLeadById, createLead, updateLead } = require('../controllers/leadController');

const router = express.Router();

router.get('/', getLeads);
router.get('/:id', getLeadById);
router.post('/', createLead);
router.put('/:id', updateLead);

module.exports = router;
