import { useEffect, useState } from 'react';
import { RefreshCw, MessageSquare, Sparkles } from 'lucide-react';
import { getCalls } from '../services/api';

export default function CallHistory() {
  const [calls, setCalls] = useState([]);
  const [selectedCall, setSelectedCall] = useState(null);
  const [loading, setLoading] = useState(true);

  const loadCalls = async () => {
    setLoading(true);
    try {
      const data = await getCalls();
      setCalls(data.calls || []);
      if (data.calls?.length && !selectedCall) {
        setSelectedCall(data.calls[0]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCalls();
  }, []);

  const sentimentBadge = (sentiment) => {
    if (sentiment === 'Positive') return 'bg-emerald-500/15 text-emerald-300';
    if (sentiment === 'Negative') return 'bg-rose-500/15 text-rose-300';
    return 'bg-slate-700 text-slate-300';
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Call History &amp; AI Summaries</h2>
          <p className="text-sm text-slate-400">
            Transcripts stored in MongoDB and analyzed asynchronously by BullMQ workers.
          </p>
        </div>
        <button
          onClick={loadCalls}
          className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-sm text-slate-200 border border-slate-700 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Call List */}
        <div className="rounded-2xl bg-slate-900/70 border border-slate-800/80 divide-y divide-slate-800/70 max-h-[620px] overflow-y-auto">
          {calls.length === 0 ? (
            <p className="p-6 text-sm text-slate-500 text-center">No calls recorded yet.</p>
          ) : (
            calls.map((call) => (
              <button
                key={call._id}
                onClick={() => setSelectedCall(call)}
                className={`w-full text-left p-4 transition cursor-pointer ${
                  selectedCall?._id === call._id ? 'bg-indigo-500/10' : 'hover:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="font-medium text-sm text-white">
                    {call.leadId?.name || 'Prospect'}
                  </span>
                  <span className={`px-2 py-0.5 rounded-full text-[11px] font-medium ${sentimentBadge(call.sentiment)}`}>
                    {call.sentiment}
                  </span>
                </div>
                <p className="text-xs text-slate-400">
                  {new Date(call.createdAt).toLocaleString()} • {call.duration}s
                </p>
                <p className="text-[11px] text-indigo-300 mt-1">
                  Job Status: {call.analysisStatus}
                </p>
              </button>
            ))
          )}
        </div>

        {/* Selected Call Details */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/70 border border-slate-800/80 p-6 space-y-6">
          {!selectedCall ? (
            <p className="text-sm text-slate-500 text-center py-12">
              Select a call from the left to view its AI summary and transcript.
            </p>
          ) : (
            <>
              <div className="space-y-3 pb-4 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-indigo-400" />
                    AI Summary &amp; Sentiment
                  </h3>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${sentimentBadge(selectedCall.sentiment)}`}>
                    {selectedCall.sentiment} Sentiment
                  </span>
                </div>
                <p className="text-sm text-slate-300">
                  {selectedCall.summary || 'Summary is being processed by BullMQ...'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">Requirements</span>
                    <ul className="list-disc list-inside text-slate-300 space-y-0.5">
                      {(selectedCall.requirements || []).length > 0
                        ? selectedCall.requirements.map((r, i) => <li key={i}>{r}</li>)
                        : <li>None noted</li>}
                    </ul>
                  </div>
                  <div>
                    <span className="text-slate-400 font-semibold block mb-1">Next Action</span>
                    <p className="text-emerald-300">{selectedCall.nextAction || 'Follow up with prospect.'}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="font-semibold text-white text-sm flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  Transcript
                </h4>
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-2">
                  {(selectedCall.transcript || []).map((m, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl text-xs ${
                        m.role === 'customer'
                          ? 'bg-indigo-600/20 border border-indigo-500/20 text-indigo-100'
                          : 'bg-slate-800/70 text-slate-200'
                      }`}
                    >
                      <span className="font-semibold uppercase text-[10px] opacity-70 block mb-0.5">
                        {m.role === 'customer' ? 'Customer' : 'VoxLead AI'}
                      </span>
                      {m.text}
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
