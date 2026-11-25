import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  PhoneCall,
  Users,
  Calendar,
  BookOpen,
  History,
  Menu,
  X,
  Sparkles,
} from 'lucide-react';
import { getHealth } from '../services/api';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/voice-agent', label: 'AI Voice Agent', icon: PhoneCall },
  { to: '/leads', label: 'Leads CRM', icon: Users },
  { to: '/appointments', label: 'Appointments', icon: Calendar },
  { to: '/knowledge', label: 'Knowledge Base', icon: BookOpen },
  { to: '/calls', label: 'Call History', icon: History },
];

export default function Layout({ children }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [health, setHealth] = useState(null);

  useEffect(() => {
    getHealth()
      .then(setHealth)
      .catch(() => setHealth(null));
  }, []);

  return (
    <div className="min-h-screen flex flex-col md:flex-row">
      {/* Mobile Header */}
      <header className="md:hidden flex items-center justify-between px-4 py-3 border-b border-slate-800/80 bg-slate-950/90 backdrop-blur">
        <div className="flex items-center gap-2 font-semibold text-lg">
          <Sparkles className="w-5 h-5 text-indigo-400" />
          <span>VoxLead AI</span>
        </div>
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="p-2 rounded-lg text-slate-300 hover:bg-slate-800"
          aria-label="Toggle Menu"
        >
          {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </header>

      {/* Sidebar */}
      <aside
        className={`${
          mobileOpen ? 'block' : 'hidden'
        } md:flex md:flex-col md:w-64 md:shrink-0 border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-xl`}
      >
        <div className="hidden md:flex items-center gap-2.5 px-6 py-5 border-b border-slate-800/80">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="font-bold text-base tracking-tight text-white">VoxLead AI</h1>
            <p className="text-xs text-slate-400">Autonomous Sales Agent</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-indigo-500/15 text-indigo-300 border border-indigo-500/30'
                    : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* System Status Footer */}
        <div className="p-4 m-3 rounded-xl bg-slate-900/80 border border-slate-800/80 text-xs space-y-2">
          <p className="font-semibold text-slate-300 uppercase tracking-wider text-[10px]">
            System Status
          </p>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">MongoDB</span>
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                health?.mongodb === 'connected'
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              {health?.mongodb === 'connected' ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Redis</span>
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                health?.redis?.connected
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {health?.redis?.connected ? 'Connected' : 'Offline'}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Groq AI</span>
            <span
              className={`px-2 py-0.5 rounded-full font-medium ${
                health?.groqConfigured
                  ? 'bg-emerald-500/15 text-emerald-400'
                  : 'bg-amber-500/15 text-amber-400'
              }`}
            >
              {health?.groqConfigured ? 'Ready' : 'Key Missing'}
            </span>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">{children}</main>
    </div>
  );
}
