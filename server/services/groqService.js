const Groq = require('groq-sdk');

const DEFAULT_MODEL = process.env.GROQ_MODEL || 'openai/gpt-oss-20b';

function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey || apiKey === 'your_groq_api_key_here') {
    throw new Error('GROQ_API_KEY is not configured in .env');
  }
  return new Groq({ apiKey });
}

/**
 * Safely parses JSON returned by the LLM (handles optional ```json code fences).
 */
function parseJsonResponse(text) {
  const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
  return JSON.parse(cleaned);
}

/**
 * Generates a conversational sales agent reply using Groq.
 * Combines Redis conversation history + RAG retrieved company chunks.
 */
async function generateSalesReply({
  message,
  history = [],
  retrievedChunks = [],
  language = 'en',
  availableSlots = [],
}) {
  const groq = getGroqClient();

  const contextBlock =
    retrievedChunks.length > 0
      ? retrievedChunks
          .map((c, idx) => `[Source ${idx + 1}: ${c.filename}]\n${c.text}`)
          .join('\n\n')
      : 'No relevant company documents were found for this question.';

  const slotsText =
    availableSlots.length > 0
      ? availableSlots.slice(0, 6).map((s) => `${s.date} at ${s.time}`).join(', ')
      : 'No open demo slots available right now.';

  const languageInstruction =
    language === 'hi'
      ? 'Respond in polite, natural Hindi (Devanagari script or simple conversational Hindi).'
      : 'Respond in natural, professional English.';

  const systemPrompt = `You are VoxLead AI, a friendly, professional autonomous AI sales representative.

CORE RULES:
1. ${languageInstruction}
2. Keep responses concise (2-3 sentences max) so they sound natural when spoken aloud on a voice call.
3. Ask ONLY ONE question at a time.
4. Answer product, pricing, feature, and policy questions ONLY using the COMPANY KNOWLEDGE BASE below.
5. NEVER invent product prices, features, or policies. If the knowledge base does not contain the answer, honestly say you do not have that exact detail right now and offer to connect them with a specialist or book a demo.
6. Naturally collect customer details during the conversation: name, company, number of employees, budget, purchase timeline, email, and phone number.
7. Understand buying intent and suggest a product demonstration when appropriate.
8. If the customer wants to book a demo, offer these available slots: ${slotsText}.

COMPANY KNOWLEDGE BASE CONTEXT:
${contextBlock}`;

  // Convert stored Redis history into Groq chat messages
  const formattedHistory = history.slice(-12).map((item) => ({
    role: item.role === 'customer' ? 'user' : 'assistant',
    content: item.text,
  }));

  const messages = [
    { role: 'system', content: systemPrompt },
    ...formattedHistory,
    { role: 'user', content: message },
  ];

  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages,
    temperature: 0.4,
    max_tokens: 280,
  });

  return completion.choices[0]?.message?.content?.trim() || 'I am sorry, could you repeat that?';
}

/**
 * Extracts structured customer lead fields from a conversation transcript using Groq.
 */
async function extractLeadData(transcript = []) {
  const groq = getGroqClient();

  const transcriptText = transcript
    .map((m) => `${m.role === 'customer' ? 'Customer' : 'Agent'}: ${m.text}`)
    .join('\n');

  const prompt = `Extract customer lead details from the sales call transcript below.
Return ONLY valid JSON with these exact keys (use empty string "" if unknown):
{
  "name": "",
  "email": "",
  "phone": "",
  "company": "",
  "employees": "",
  "budget": "",
  "productInterest": "",
  "purchaseTimeline": "",
  "buyingIntent": "High | Medium | Low | Unknown",
  "sentiment": "Positive | Neutral | Negative"
}

TRANSCRIPT:
${transcriptText}`;

  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.1,
    max_tokens: 350,
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  try {
    return parseJsonResponse(raw);
  } catch (err) {
    console.warn('[GroqService] Failed to parse lead JSON, returning defaults:', err.message);
    return {
      name: '',
      email: '',
      phone: '',
      company: '',
      employees: '',
      budget: '',
      productInterest: '',
      purchaseTimeline: '',
      buyingIntent: 'Unknown',
      sentiment: 'Neutral',
    };
  }
}

/**
 * Calculates lead score (0-100) and status (Hot / Warm / Cold)
 * using simple, transparent JavaScript conditions rather than relying solely on AI.
 */
function calculateLeadScore(leadData = {}) {
  let score = 15; // Base score for starting a conversation

  const timeline = (leadData.purchaseTimeline || '').toLowerCase();
  const budget = (leadData.budget || '').toLowerCase();
  const intent = (leadData.buyingIntent || '').toLowerCase();
  const employees = parseInt(String(leadData.employees || '').replace(/[^0-9]/g, ''), 10);

  // 1. Purchase timeline scoring
  if (
    timeline.includes('immediate') ||
    timeline.includes('this week') ||
    timeline.includes('this month') ||
    timeline.includes('asap') ||
    timeline.includes('soon') ||
    timeline.includes('days')
  ) {
    score += 30;
  } else if (
    timeline.includes('quarter') ||
    timeline.includes('1-3 month') ||
    timeline.includes('2 month') ||
    timeline.includes('3 month') ||
    timeline.includes('next month')
  ) {
    score += 18;
  } else if (timeline.trim().length > 0) {
    score += 8;
  }

  // 2. Budget presence scoring
  if (budget.trim().length > 0 && !budget.includes('no budget') && !budget.includes('none')) {
    score += 20;
  }

  // 3. Buying intent scoring
  if (intent === 'high') {
    score += 25;
  } else if (intent === 'medium') {
    score += 12;
  } else if (intent === 'low') {
    score += 0;
  }

  // 4. Contact & company completeness
  if (leadData.email && leadData.email.includes('@')) score += 5;
  if (leadData.phone && leadData.phone.trim().length >= 7) score += 5;
  if (!Number.isNaN(employees) && employees >= 20) score += 5;

  // Clamp between 0 and 100
  const leadScore = Math.max(0, Math.min(100, score));

  let leadStatus = 'Cold';
  if (leadScore >= 70) {
    leadStatus = 'Hot';
  } else if (leadScore >= 40) {
    leadStatus = 'Warm';
  }

  return { leadScore, leadStatus };
}

/**
 * Generates a structured call summary and sentiment analysis using Groq.
 */
async function summarizeCallTranscript(transcript = []) {
  const groq = getGroqClient();

  const transcriptText = transcript
    .map((m) => `${m.role === 'customer' ? 'Customer' : 'Agent'}: ${m.text}`)
    .join('\n');

  const prompt = `Analyze this sales call transcript and return ONLY valid JSON with these exact keys:
{
  "summary": "2-3 sentence summary of the call",
  "requirements": ["requirement 1", "requirement 2"],
  "objections": ["objection 1 if any"],
  "purchaseIntent": "High | Medium | Low",
  "sentiment": "Positive | Neutral | Negative",
  "nextAction": "Clear recommended next step for the sales team"
}

TRANSCRIPT:
${transcriptText}`;

  const completion = await groq.chat.completions.create({
    model: DEFAULT_MODEL,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.2,
    max_tokens: 450,
  });

  const raw = completion.choices[0]?.message?.content || '{}';
  try {
    const parsed = parseJsonResponse(raw);
    return {
      summary: parsed.summary || 'Call completed.',
      requirements: Array.isArray(parsed.requirements) ? parsed.requirements : [],
      objections: Array.isArray(parsed.objections) ? parsed.objections : [],
      purchaseIntent: parsed.purchaseIntent || 'Medium',
      sentiment: ['Positive', 'Neutral', 'Negative'].includes(parsed.sentiment)
        ? parsed.sentiment
        : 'Neutral',
      nextAction: parsed.nextAction || 'Follow up with the prospect via email.',
    };
  } catch (err) {
    console.warn('[GroqService] Failed to parse summary JSON:', err.message);
    return {
      summary: 'Call completed and transcript saved.',
      requirements: [],
      objections: [],
      purchaseIntent: 'Unknown',
      sentiment: 'Neutral',
      nextAction: 'Review transcript and follow up with customer.',
    };
  }
}

module.exports = {
  generateSalesReply,
  extractLeadData,
  calculateLeadScore,
  summarizeCallTranscript,
};
