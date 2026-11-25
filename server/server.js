const path = require('path');
const dotenv = require('dotenv');

// Load .env from project root first, then fallback to server/.env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '.env') });

const express = require('express');
const cors = require('cors');
const { connectDB, isDbConnected } = require('./config/db');
const { connectRedis, getRedisStatus, isRedisReady } = require('./config/redis');
const { initCallQueue } = require('./queues/callQueue');
const { startCallWorker } = require('./workers/callWorker');

const aiRoutes = require('./routes/aiRoutes');
const leadRoutes = require('./routes/leadRoutes');
const callRoutes = require('./routes/callRoutes');
const knowledgeRoutes = require('./routes/knowledgeRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(
  cors({
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    credentials: true,
  })
);
app.use(express.json({ limit: '2mb' }));

// Health check endpoint showing real connection status for MongoDB and Redis
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    mongodb: isDbConnected() ? 'connected' : 'disconnected',
    redis: getRedisStatus(),
    groqConfigured: Boolean(
      process.env.GROQ_API_KEY && process.env.GROQ_API_KEY !== 'your_groq_api_key_here'
    ),
    huggingfaceConfigured: Boolean(
      process.env.HUGGINGFACE_API_KEY &&
        process.env.HUGGINGFACE_API_KEY !== 'your_huggingface_api_key_here'
    ),
  });
});

// API Routes
app.use('/api/ai', aiRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/calls', callRoutes);
app.use('/api/knowledge', knowledgeRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Global error handler (handles Multer file size/type errors cleanly)
app.use((err, req, res, next) => {
  console.error('[Server] Unhandled error:', err.message);
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File is too large. Maximum size is 5MB.' });
  }
  return res.status(err.status || 500).json({
    error: err.message || 'Internal server error.',
  });
});

async function startServer() {
  await connectDB();
  await connectRedis();

  // Only start BullMQ queue and worker when Redis is genuinely connected
  if (isRedisReady()) {
    initCallQueue();
    startCallWorker();
  } else {
    console.warn('[Server] Skipping BullMQ worker startup because Redis is not connected.');
  }

  app.listen(PORT, () => {
    console.log(`[Server] VoxLead AI backend running on http://localhost:${PORT}`);
  });
}

startServer();
