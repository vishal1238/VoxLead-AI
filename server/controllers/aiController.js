const Lead = require('../models/Lead');
const Appointment = require('../models/Appointment');
const {
  getConversationHistory,
  appendConversationMessage,
  invalidateDashboardCache,
} = require('../services/cacheService');
const { retrieveRelevantChunks } = require('../services/ragService');
const {
  generateSalesReply,
  extractLeadData,
  calculateLeadScore,
  summarizeCallTranscript,
} = require('../services/groqService');

const DEMO_SLOTS = ['10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'];

/**
 * Helper to fetch open appointment slots for today and tomorrow
 * so the AI can suggest real available times during a call.
 */
async function getUpcomingAvailableSlots() {
  const dates = [];
  for (let i = 0; i < 3; i += 1) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    dates.push(d.toISOString().split('T')[0]);
  }

  const booked = await Appointment.find({
    date: { $in: dates },
    status: { $ne: 'Cancelled' },
  }).lean();

  const bookedSet = new Set(booked.map((b) => `${b.date}|${b.time}`));
  const available = [];

  for (const date of dates) {
    for (const time of DEMO_SLOTS) {
      if (!bookedSet.has(`${date}|${time}`)) {
        available.push({ date, time });
      }
    }
  }

  return available;
}

/**
 * POST /api/ai/chat
 * Handles a customer turn:
 * 1. Loads conversation history from Redis
 * 2. Runs Moderate RAG (embedding + cosine similarity) on Knowledge Base
 * 3. Calls Groq LLM with history + retrieved context
 * 4. Saves customer + AI messages back to Redis
 */
async function chatWithAI(req, res) {
  try {
    const { callId, message, language = 'en', fallbackHistory = [] } = req.body;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    // 1. Retrieve conversation history from Redis (or fallback to client history if Redis is down)
    let history = await getConversationHistory(callId);
    const memorySource = history !== null ? 'redis' : 'client-fallback';
    if (history === null) {
      history = Array.isArray(fallbackHistory) ? fallbackHistory : [];
    }

    // 2. Retrieve relevant company knowledge chunks via Moderate RAG
    const ragResult = await retrieveRelevantChunks(message, 3);

    // 3. Get real available demo slots
    const availableSlots = await getUpcomingAvailableSlots();

    // 4. Generate conversational reply via Groq
    const reply = await generateSalesReply({
      message: message.trim(),
      history,
      retrievedChunks: ragResult.chunks,
      language,
      availableSlots,
    });

    // 5. Save both messages in Redis conversation memory (TTL 1 hour)
    if (callId && memorySource === 'redis') {
      await appendConversationMessage(callId, 'customer', message.trim());
      await appendConversationMessage(callId, 'assistant', reply);
    }

    return res.json({
      reply,
      memorySource,
      rag: {
        method: ragResult.method,
        chunksUsed: ragResult.chunks.length,
        sources: ragResult.chunks.map((c) => ({
          filename: c.filename,
          score: Number(c.score.toFixed(3)),
        })),
        error: ragResult.error,
      },
    });
  } catch (error) {
    console.error('[AIController] chatWithAI error:', error.message);
    return res.status(500).json({
      error: error.message || 'Failed to generate AI response.',
    });
  }
}

/**
 * POST /api/ai/qualify-lead
 * Extracts structured lead details from the call transcript using Groq,
 * computes lead score in JavaScript, and saves/updates the Lead in MongoDB.
 */
async function qualifyLead(req, res) {
  try {
    const { callId, transcript: bodyTranscript, leadId } = req.body;

    let transcript = bodyTranscript;
    if (!Array.isArray(transcript) || transcript.length === 0) {
      const redisHistory = await getConversationHistory(callId);
      transcript = redisHistory || [];
    }

    if (transcript.length === 0) {
      return res.status(400).json({ error: 'No conversation transcript available to qualify.' });
    }

    const extracted = await extractLeadData(transcript);
    const { leadScore, leadStatus } = calculateLeadScore(extracted);

    const leadPayload = {
      name: extracted.name || 'Unknown Prospect',
      email: extracted.email || '',
      phone: extracted.phone || '',
      company: extracted.company || '',
      employees: extracted.employees || '',
      budget: extracted.budget || '',
      productInterest: extracted.productInterest || '',
      purchaseTimeline: extracted.purchaseTimeline || '',
      buyingIntent: ['High', 'Medium', 'Low', 'Unknown'].includes(extracted.buyingIntent)
        ? extracted.buyingIntent
        : 'Unknown',
      sentiment: ['Positive', 'Neutral', 'Negative'].includes(extracted.sentiment)
        ? extracted.sentiment
        : 'Neutral',
      leadScore,
      leadStatus,
    };

    let lead;
    if (leadId) {
      lead = await Lead.findByIdAndUpdate(leadId, leadPayload, { new: true });
    } else {
      lead = await Lead.create(leadPayload);
    }

    await invalidateDashboardCache();

    return res.json({ lead });
  } catch (error) {
    console.error('[AIController] qualifyLead error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to qualify lead.' });
  }
}

/**
 * POST /api/ai/summarize-call
 * Generates a call summary & sentiment analysis directly on demand.
 */
async function summarizeCall(req, res) {
  try {
    const { callId, transcript: bodyTranscript } = req.body;

    let transcript = bodyTranscript;
    if (!Array.isArray(transcript) || transcript.length === 0) {
      const redisHistory = await getConversationHistory(callId);
      transcript = redisHistory || [];
    }

    if (transcript.length === 0) {
      return res.status(400).json({ error: 'Transcript is required for summarization.' });
    }

    const analysis = await summarizeCallTranscript(transcript);
    return res.json(analysis);
  } catch (error) {
    console.error('[AIController] summarizeCall error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to summarize call.' });
  }
}

module.exports = {
  chatWithAI,
  qualifyLead,
  summarizeCall,
};
