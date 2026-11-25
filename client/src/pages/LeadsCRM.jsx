import { useEffect, useState } from 'react';
import { Search, Filter, Eye, X } from 'lucide-react';
import { getLeads } from '../services/api';

export default function LeadsCRM() {
  const [leads, setLeads] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [selectedLead, setSelectedLead] = useState(null);

  const fetchLeads = async () => {
    setLoading(true);
    try {
      const data = await getLeads({ search, status: statusFilter });
      setLeads(data.leads || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, [statusFilter]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchLeads();
  };

  const badgeStyle = (status) => {
    if (status === 'Hot') return 'bg-rose-500/15 text-rose-300 border-rose-500/30';
    if (status === 'Warm') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
    return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Leads CRM</h2>
        <p className="text-sm text-slate-400">
          Qualified prospects stored permanently in MongoDB.
        </p>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <form onSubmit={handleSearchSubmit} className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, company, email, or product..."
              className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-sm font-medium text-white cursor-pointer"
          >
            Search
          </button>
        </form>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-800 text-sm text-slate-200"
          >
            <option value="">All Statuses</option>
            <option value="Hot">Hot</option>
            <option value="Warm">Warm</option>
            <option value="Cold">Cold</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-5 py-3.5">Customer</th>
              <th className="px-5 py-3.5">Company</th>
              <th className="px-5 py-3.5">Contact</th>
              <th className="px-5 py-3.5">Score</th>
              <th className="px-5 py-3.5">Status</th>
              <th className="px-5 py-3.5">Timeline</th>
              <th className="px-5 py-3.5">Created</th>
              <th className="px-5 py-3.5 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {loading ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                  Loading leads...
                </td>
              </tr>
            ) : leads.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-5 py-8 text-center text-slate-500">
                  No leads found. Complete an AI voice call to qualify and save a lead.
                </td>
              </tr>
            ) : (
              leads.map((lead) => (
                <tr key={lead._id} className="hover:bg-slate-800/40">
                  <td className="px-5 py-3.5 font-medium text-white">{lead.name}</td>
                  <td className="px-5 py-3.5 text-slate-300">{lead.company || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    <div>{lead.email || '—'}</div>
                    <div>{lead.phone || ''}</div>
                  </td>
                  <td className="px-5 py-3.5 font-semibold text-white">{lead.leadScore}</td>
                  <td className="px-5 py-3.5">
                    <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${badgeStyle(lead.leadStatus)}`}>
                      {lead.leadStatus}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-slate-300">{lead.purchaseTimeline || '—'}</td>
                  <td className="px-5 py-3.5 text-slate-400 text-xs">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-5 py-3.5 text-right">
                    <button
                      onClick={() => setSelectedLead(lead)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                      aria-label="View Lead Details"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Lead Details Modal */}
      {selectedLead && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg rounded-2xl bg-slate-900 border border-slate-700 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-white">{selectedLead.name}</h3>
              <button
                onClick={() => setSelectedLead(null)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-400 block text-xs">Company</span>{selectedLead.company || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Employees</span>{selectedLead.employees || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Email</span>{selectedLead.email || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Phone</span>{selectedLead.phone || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Budget</span>{selectedLead.budget || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Timeline</span>{selectedLead.purchaseTimeline || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Product Interest</span>{selectedLead.productInterest || '—'}</div>
              <div><span className="text-slate-400 block text-xs">Lead Score</span>{selectedLead.leadScore}/100 ({selectedLead.leadStatus})</div>
              <div><span className="text-slate-400 block text-xs">Buying Intent</span>{selectedLead.buyingIntent}</div>
              <div><span className="text-slate-400 block text-xs">Sentiment</span>{selectedLead.sentiment}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
