const Lead = require('../models/Lead');
const { calculateLeadScore } = require('../services/groqService');
const { invalidateDashboardCache } = require('../services/cacheService');

/**
 * GET /api/leads
 * Returns all leads with optional search and status filters.
 */
async function getLeads(req, res) {
  try {
    const { search = '', status = '' } = req.query;
    const query = {};

    if (status && ['Hot', 'Warm', 'Cold'].includes(status)) {
      query.leadStatus = status;
    }

    if (search.trim()) {
      const regex = new RegExp(search.trim(), 'i');
      query.$or = [
        { name: regex },
        { company: regex },
        { email: regex },
        { phone: regex },
        { productInterest: regex },
      ];
    }

    const leads = await Lead.find(query).sort({ createdAt: -1 }).lean();
    return res.json({ leads });
  } catch (error) {
    console.error('[LeadController] getLeads error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch leads.' });
  }
}

/**
 * GET /api/leads/:id
 */
async function getLeadById(req, res) {
  try {
    const lead = await Lead.findById(req.params.id).lean();
    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }
    return res.json({ lead });
  } catch (error) {
    console.error('[LeadController] getLeadById error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch lead.' });
  }
}

/**
 * POST /api/leads
 */
async function createLead(req, res) {
  try {
    const data = req.body;
    const { leadScore, leadStatus } = calculateLeadScore(data);

    const lead = await Lead.create({
      ...data,
      leadScore: data.leadScore ?? leadScore,
      leadStatus: data.leadStatus || leadStatus,
    });

    await invalidateDashboardCache();
    return res.status(201).json({ lead });
  } catch (error) {
    console.error('[LeadController] createLead error:', error.message);
    return res.status(500).json({ error: 'Failed to create lead.' });
  }
}

/**
 * PUT /api/leads/:id
 */
async function updateLead(req, res) {
  try {
    const lead = await Lead.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!lead) {
      return res.status(404).json({ error: 'Lead not found.' });
    }

    await invalidateDashboardCache();
    return res.json({ lead });
  } catch (error) {
    console.error('[LeadController] updateLead error:', error.message);
    return res.status(500).json({ error: 'Failed to update lead.' });
  }
}

module.exports = {
  getLeads,
  getLeadById,
  createLead,
  updateLead,
};
