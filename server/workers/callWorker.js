const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const Call = require('../models/Call');
const Lead = require('../models/Lead');
const { summarizeCallTranscript } = require('../services/groqService');
const { invalidateDashboardCache } = require('../services/cacheService');

let callWorker = null;
let workerConnection = null;

/**
 * Starts the BullMQ Worker that processes call summary and sentiment analysis
 * asynchronously in the background.
 */
function startCallWorker() {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('[CallWorker] REDIS_URL not set. Background worker not started.');
    return null;
  }

  try {
    workerConnection = new IORedis(redisUrl, {
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
      retryStrategy: (times) => (times > 5 ? null : Math.min(times * 500, 3000)),
    });

    workerConnection.on('error', (err) => {
      console.error(`[CallWorker] Redis connection error: ${err.message}`);
    });

    callWorker = new Worker(
      'call-analysis',
      async (job) => {
        const { callMongoId } = job.data;
        console.log(`[CallWorker] Processing job ${job.id} for Call ${callMongoId}`);

        const call = await Call.findById(callMongoId);
        if (!call) {
          throw new Error(`Call record ${callMongoId} not found in MongoDB`);
        }

        // Update status to processing
        call.analysisStatus = 'processing';
        await call.save();

        // Generate summary & sentiment using Groq
        const analysis = await summarizeCallTranscript(call.transcript);

        call.summary = analysis.summary;
        call.requirements = analysis.requirements;
        call.objections = analysis.objections;
        call.purchaseIntent = analysis.purchaseIntent;
        call.sentiment = analysis.sentiment;
        call.nextAction = analysis.nextAction;
        call.analysisStatus = 'completed';
        call.analysisError = '';
        await call.save();

        // Also update linked Lead sentiment if a lead is attached
        if (call.leadId) {
          await Lead.findByIdAndUpdate(call.leadId, {
            sentiment: analysis.sentiment,
          });
        }

        // Invalidate dashboard cache so updated call summary & sentiment appear
        await invalidateDashboardCache();

        console.log(`[CallWorker] Completed job ${job.id} (Sentiment: ${analysis.sentiment})`);
        return { callId: call.callId, sentiment: analysis.sentiment };
      },
      {
        connection: workerConnection,
        skipVersionCheck: true, // Required for hosted Redis (e.g., Upstash) that restricts INFO
        concurrency: 2,
      }
    );

    callWorker.on('failed', async (job, err) => {
      console.error(`[CallWorker] Job ${job?.id} failed: ${err.message}`);
      if (job?.data?.callMongoId) {
        try {
          await Call.findByIdAndUpdate(job.data.callMongoId, {
            analysisStatus: 'failed',
            analysisError: err.message,
          });
        } catch (updateErr) {
          console.error(`[CallWorker] Failed to update error status: ${updateErr.message}`);
        }
      }
    });

    console.log('[CallWorker] BullMQ worker listening on "call-analysis"');
    return callWorker;
  } catch (error) {
    console.error(`[CallWorker] Failed to start worker: ${error.message}`);
    return null;
  }
}

module.exports = {
  startCallWorker,
};
