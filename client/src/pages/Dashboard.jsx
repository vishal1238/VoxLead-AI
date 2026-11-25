import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Users,
  Flame,
  Sun,
  Snowflake,
  PhoneCall,
  Calendar,
  RefreshCw,
  Database,
  Zap,
  ArrowRight,
} from 'lucide-react';
import { getDashboardStats } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getDashboardStats();
      setStats(data);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not load dashboard statistics.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  const counts = stats?.counts || {
    totalLeads: 0,
    hotLeads: 0,
    warmLeads: 0,
    coldLeads: 0,
    totalCalls: 0,
    upcomingAppointments: 0,
    totalDocuments: 0,
  };

  const statCards = [
    { label: 'Total Leads', value: counts.totalLeads, icon: Users, color: 'text-indigo-400', bg: 'bg-indigo-500/10' },
    { label: 'Hot Leads', value: counts.hotLeads, icon: Flame, color: 'text-rose-400', bg: 'bg-rose-500/10' },
    { label: 'Warm Leads', value: counts.warmLeads, icon: Sun, color: 'text-amber-400', bg: 'bg-amber-500/10' },
    { label: 'Cold Leads', value: counts.coldLeads, icon: Snowflake, color: 'text-cyan-400', bg: 'bg-cyan-500/10' },
    { label: 'Total Calls', value: counts.totalCalls, icon: PhoneCall, color: 'text-emerald-400', bg: 'bg-emerald-500/10' },
    { label: 'Upcoming Demos', value: counts.upcomingAppointments, icon: Calendar, color: 'text-violet-400', bg: 'bg-violet-500/10' },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">CRM Dashboard</h2>
          <p className="text-sm text-slate-400">
            Real-time sales pipeline overview with Redis 60s caching.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {stats?.cache && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border ${
                stats.cache.hit
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-800/80 text-slate-300 border-slate-700'
              }`}
            >
              {stats.cache.hit ? (
                <>
                  <Zap className="w-3.5 h-3.5" /> Cache Hit (Redis)
                </>
              ) : (
                <>
                  <Database className="w-3.5 h-3.5" /> Fresh Query (MongoDB)
                </>
              )}
            </span>
          )}

          <button
            onClick={loadStats}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm font-medium text-slate-200 border border-slate-700 transition cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <Link
            to="/voice-agent"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white shadow-lg shadow-indigo-500/20 transition"
          >
            <PhoneCall className="w-4 h-4" />
            Start AI Call
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {statCards.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 backdrop-blur flex flex-col justify-between gap-3"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-400">{label}</span>
              <div className={`p-2 rounded-lg ${bg}`}>
                <Icon className={`w-4 h-4 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-white">{loading ? '—' : value}</p>
          </div>
        ))}
      </div>

      {/* Recent Calls & Upcoming Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Calls */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Recent AI Calls</h3>
            <Link to="/calls" className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
              View all <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!stats?.recentCalls?.length ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No calls recorded yet. Start an AI voice call to see activity here.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.recentCalls.map((call) => (
                <div
                  key={call._id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70 flex items-start justify-between gap-3"
                >
                  <div className="space-y-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">
                      {call.leadId?.name || 'Prospect'} {call.leadId?.company ? `• ${call.leadId.company}` : ''}
                    </p>
                    <p className="text-xs text-slate-400 line-clamp-2">
                      {call.summary || 'Analysis pending in BullMQ background worker...'}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      call.sentiment === 'Positive'
                        ? 'bg-emerald-500/15 text-emerald-300'
                        : call.sentiment === 'Negative'
                          ? 'bg-rose-500/15 text-rose-300'
                          : 'bg-slate-700 text-slate-300'
                    }`}
                  >
                    {call.sentiment || 'Neutral'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Appointments */}
        <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-white">Upcoming Demo Appointments</h3>
            <Link to="/appointments" className="text-xs text-indigo-400 hover:text-indigo-300 inline-flex items-center gap-1">
              Manage <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {!stats?.upcomingAppointments?.length ? (
            <p className="text-sm text-slate-500 py-6 text-center">
              No upcoming appointments booked yet.
            </p>
          ) : (
            <div className="space-y-3">
              {stats.upcomingAppointments.map((apt) => (
                <div
                  key={apt._id}
                  className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800/70 flex items-center justify-between gap-3"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-200">
                      {apt.customerName} {apt.company ? `• ${apt.company}` : ''}
                    </p>
                    <p className="text-xs text-slate-400">
                      {apt.date} at {apt.time}
                    </p>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-500/15 text-indigo-300">
                    {apt.status}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
