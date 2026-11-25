const express = require('express');
const { chatWithAI, qualifyLead, summarizeCall } = require('../controllers/aiController');
const { createRateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Protect AI endpoints with Redis-backed rate limiting (30 requests/minute per IP)
const aiRateLimiter = createRateLimiter({ windowSeconds: 60, maxRequests: 30 });

router.post('/chat', aiRateLimiter, chatWithAI);
router.post('/qualify-lead', aiRateLimiter, qualifyLead);
router.post('/summarize-call', aiRateLimiter, summarizeCall);

module.exports = router;
