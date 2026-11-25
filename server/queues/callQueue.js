const { Queue } = require('bullmq');
const IORedis = require('ioredis');
const { isRedisReady } = require('../config/redis');

let callQueue = null;
let queueConnection = null;

/**
 * Initializes the BullMQ Queue for background call summary & sentiment analysis.
 * BullMQ uses ioredis under the hood.
 */
function initCallQueue() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[CallQueue] REDIS_URL not set. Background job queue disabled.');
    return null;
  }

  try {
    queueConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 3000)),
    });

    queueConnection.on('error', (err) => {
      console.error(`[CallQueue] Redis connection error: ${err.message}`);
    });

    callQueue = new Queue('call-analysis', {
      connection: queueConnection,
      skipVersionCheck: true, // Required for hosted Redis (e.g., Upstash) that restricts INFO
      defaultJobOptions: {
        attempts: 3, // Retry up to 3 times if Groq API temporarily fails
        backoff: {
          type: 'exponential',
          delay: 2000,
        },
        removeOnComplete: 50,
        removeOnFail: 50,
      },
    });

    console.log('[CallQueue] BullMQ queue "call-analysis" initialized');
    return callQueue;
  } catch (error) {
    console.error(`[CallQueue] Failed to initialize: ${error.message}`);
    return null;
  }
}

/**
 * Adds a call summary & sentiment analysis job to the BullMQ queue.
 * If Redis is offline, returns { queued: false } so the API can handle it gracefully.
 */
async function enqueueCallSummaryJob(callMongoId) {
  if (!callQueue || !isRedisReady()) {
    return {
      queued: false,
      reason: 'Redis is not connected; BullMQ queue unavailable.',
    };
  }

  try {
    const job = await callQueue.add('summarize-call', {
      callMongoId: String(callMongoId),
    });

    return {
      queued: true,
      jobId: job.id,
    };
  } catch (error) {
    console.error(`[CallQueue] Failed to enqueue job: ${error.message}`);
    return {
      queued: false,
      reason: error.message,
    };
  }
}

module.exports = {
  initCallQueue,
  enqueueCallSummaryJob,
};
