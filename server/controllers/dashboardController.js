const Lead = require('../models/Lead');
const Call = require('../models/Call');
const Appointment = require('../models/Appointment');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const { getRedisStatus } = require('../config/redis');
const {
  getCachedDashboardStats,
  setCachedDashboardStats,
} = require('../services/cacheService');

/**
 * GET /api/dashboard/stats
 * 1. Checks Redis cache for dashboard statistics.
 * 2. If found, returns cached stats immediately.
 * 3. If not found, queries MongoDB, caches the result in Redis for 60 seconds, and returns it.
 */
async function getDashboardStats(req, res) {
  try {
    const redisStatus = getRedisStatus();
    const cached = await getCachedDashboardStats();

    if (cached) {
      return res.json({
        ...cached,
        cache: { hit: true, source: 'redis', ttlSeconds: 60 },
        redis: redisStatus,
      });
    }

    const today = new Date().toISOString().split('T')[0];

    const [
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      totalCalls,
      upcomingAppointmentsCount,
      totalDocuments,
      recentCalls,
      upcomingAppointments,
    ] = await Promise.all([
      Lead.countDocuments(),
      Lead.countDocuments({ leadStatus: 'Hot' }),
      Lead.countDocuments({ leadStatus: 'Warm' }),
      Lead.countDocuments({ leadStatus: 'Cold' }),
      Call.countDocuments(),
      Appointment.countDocuments({ date: { $gte: today }, status: 'Confirmed' }),
      KnowledgeDocument.countDocuments(),
      Call.find()
        .populate('leadId', 'name company leadStatus')
        .sort({ createdAt: -1 })
        .limit(5)
        .lean(),
      Appointment.find({ date: { $gte: today }, status: 'Confirmed' })
        .sort({ date: 1, time: 1 })
        .limit(5)
        .lean(),
    ]);

    const stats = {
      counts: {
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        totalCalls,
        upcomingAppointments: upcomingAppointmentsCount,
        totalDocuments,
      },
      recentCalls,
      upcomingAppointments,
      generatedAt: new Date().toISOString(),
    };

    // Cache in Redis for 60 seconds
    await setCachedDashboardStats(stats);

    return res.json({
      ...stats,
      cache: { hit: false, source: 'mongodb', ttlSeconds: 60 },
      redis: redisStatus,
    });
  } catch (error) {
    console.error('[DashboardController] getDashboardStats error:', error.message);
    return res.status(500).json({ error: 'Failed to load dashboard statistics.' });
  }
}

module.exports = {
  getDashboardStats,
};
