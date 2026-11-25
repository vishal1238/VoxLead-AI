const Call = require('../models/Call');
const Lead = require('../models/Lead');
const {
  getConversationHistory,
  clearConversationMemory,
  invalidateDashboardCache,
} = require('../services/cacheService');
const { enqueueCallSummaryJob } = require('../queues/callQueue');
const { summarizeCallTranscript } = require('../services/groqService');

/**
 * POST /api/calls
 * Ends an active call:
 * 1. Retrieves full transcript from Redis (or request body fallback)
 * 2. Saves Call permanently in MongoDB
 * 3. Deletes temporary Redis conversation memory
 * 4. Enqueues a BullMQ background job for AI summary & sentiment analysis
 *    (Falls back to inline summary if Redis/BullMQ is unavailable)
 */
async function createCall(req, res) {
  try {
    const { callId, leadId = null, transcript: bodyTranscript, duration = 0, language = 'en' } = req.body;

    if (!callId) {
      return res.status(400).json({ error: 'callId is required.' });
    }

    const redisTranscript = await getConversationHistory(callId);
    const finalTranscript =
      Array.isArray(redisTranscript) && redisTranscript.length > 0
        ? redisTranscript
        : Array.isArray(bodyTranscript)
          ? bodyTranscript
          : [];

    if (finalTranscript.length === 0) {
      return res.status(400).json({ error: 'Cannot save an empty call transcript.' });
    }

    // Save call record permanently in MongoDB
    const call = await Call.create({
      callId,
      leadId: leadId || null,
      transcript: finalTranscript,
      duration,
      language,
      analysisStatus: 'pending',
    });

    // Clear temporary Redis conversation memory after saving to MongoDB
    const redisCleared = await clearConversationMemory(callId);

    // Invalidate dashboard stats cache
    await invalidateDashboardCache();

    // Enqueue BullMQ background job for call summary + sentiment
    const queueResult = await enqueueCallSummaryJob(call._id);

    // If Redis/BullMQ is unavailable, run summary inline so the feature still works
    if (!queueResult.queued) {
      try {
        const analysis = await summarizeCallTranscript(finalTranscript);
        call.summary = analysis.summary;
        call.requirements = analysis.requirements;
        call.objections = analysis.objections;
        call.purchaseIntent = analysis.purchaseIntent;
        call.sentiment = analysis.sentiment;
        call.nextAction = analysis.nextAction;
        call.analysisStatus = 'completed';
        await call.save();

        if (call.leadId) {
          await Lead.findByIdAndUpdate(call.leadId, { sentiment: analysis.sentiment });
        }
      } catch (summaryErr) {
        call.analysisStatus = 'failed';
        call.analysisError = summaryErr.message;
        await call.save();
      }
    }

    return res.status(201).json({
      call,
      redisCleared,
      backgroundJob: queueResult,
    });
  } catch (error) {
    console.error('[CallController] createCall error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to save call.' });
  }
}

/**
 * GET /api/calls
 * Lists all saved calls with populated lead info.
 */
async function getCalls(req, res) {
  try {
    const calls = await Call.find()
      .populate('leadId', 'name company email leadStatus leadScore')
      .sort({ createdAt: -1 })
      .lean();
    return res.json({ calls });
  } catch (error) {
    console.error('[CallController] getCalls error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch calls.' });
  }
}

/**
 * GET /api/calls/:id
 */
async function getCallById(req, res) {
  try {
    const call = await Call.findById(req.params.id)
      .populate('leadId', 'name company email phone leadStatus leadScore')
      .lean();
    if (!call) {
      return res.status(404).json({ error: 'Call not found.' });
    }
    return res.json({ call });
  } catch (error) {
    console.error('[CallController] getCallById error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch call.' });
  }
}

module.exports = {
  createCall,
  getCalls,
  getCallById,
};
