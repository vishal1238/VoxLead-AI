const { getRedisClient, isRedisReady } = require('../config/redis');

const CONVERSATION_TTL_SECONDS = 3600; // 1 hour
const DASHBOARD_CACHE_TTL_SECONDS = 60; // 60 seconds
const DASHBOARD_CACHE_KEY = 'dashboard:stats';

/**
 * Builds the Redis key for a specific active call's conversation history.
 */
function getConversationKey(callId) {
  return `call:${callId}:messages`;
}

/**
 * Retrieves the temporary conversation history for an active call from Redis.
 * Returns an array of { role, text, timestamp } objects, or null if Redis is unavailable.
 */
async function getConversationHistory(callId) {
  if (!callId || !isRedisReady()) {
    return null;
  }

  try {
    const client = getRedisClient();
    const raw = await client.get(getConversationKey(callId));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[CacheService] Failed to get conversation history: ${error.message}`);
    return null;
  }
}

/**
 * Saves the updated conversation history for an active call in Redis
 * and refreshes the 1-hour expiration (TTL).
 */
async function saveConversationHistory(callId, messages) {
  if (!callId || !isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    const key = getConversationKey(callId);
    await client.set(key, JSON.stringify(messages));
    await client.expire(key, CONVERSATION_TTL_SECONDS);
    return true;
  } catch (error) {
    console.error(`[CacheService] Failed to save conversation history: ${error.message}`);
    return false;
  }
}

/**
 * Appends a single message (customer or assistant) to the Redis conversation memory.
 */
async function appendConversationMessage(callId, role, text) {
  if (!callId || !isRedisReady()) {
    return null;
  }

  const existing = (await getConversationHistory(callId)) || [];
  const updated = [
    ...existing,
    {
      role,
      text,
      timestamp: new Date().toISOString(),
    },
  ];
  await saveConversationHistory(callId, updated);
  return updated;
}

/**
 * Deletes temporary conversation data from Redis after the call ends
 * and the transcript has been permanently saved in MongoDB.
 */
async function clearConversationMemory(callId) {
  if (!callId || !isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    await client.del(getConversationKey(callId));
    return true;
  } catch (error) {
    console.error(`[CacheService] Failed to delete conversation memory: ${error.message}`);
    return false;
  }
}

/**
 * Fetches cached dashboard statistics from Redis if available.
 */
async function getCachedDashboardStats() {
  if (!isRedisReady()) {
    return null;
  }

  try {
    const client = getRedisClient();
    const raw = await client.get(DASHBOARD_CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    console.error(`[CacheService] Failed to read dashboard cache: ${error.message}`);
    return null;
  }
}

/**
 * Stores dashboard statistics in Redis for 60 seconds.
 */
async function setCachedDashboardStats(stats) {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    await client.set(DASHBOARD_CACHE_KEY, JSON.stringify(stats), {
      EX: DASHBOARD_CACHE_TTL_SECONDS,
    });
    return true;
  } catch (error) {
    console.error(`[CacheService] Failed to cache dashboard stats: ${error.message}`);
    return false;
  }
}

/**
 * Invalidates (deletes) the dashboard cache whenever leads, calls, or appointments change.
 */
async function invalidateDashboardCache() {
  if (!isRedisReady()) {
    return false;
  }

  try {
    const client = getRedisClient();
    await client.del(DASHBOARD_CACHE_KEY);
    return true;
  } catch (error) {
    console.error(`[CacheService] Failed to invalidate dashboard cache: ${error.message}`);
    return false;
  }
}

module.exports = {
  getConversationHistory,
  saveConversationHistory,
  appendConversationMessage,
  clearConversationMemory,
  getCachedDashboardStats,
  setCachedDashboardStats,
  invalidateDashboardCache,
};
