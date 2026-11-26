import { useEffect, useRef, useState } from 'react';
import {
  PhoneCall,
  PhoneOff,
  Mic,
  MicOff,
  Send,
  Volume2,
  VolumeX,
  UserCheck,
  CalendarCheck,
  Sparkles,
  AlertCircle,
} from 'lucide-react';
import {
  sendAIChat,
  qualifyLead,
  saveCall,
  getAppointments,
  createAppointment,
} from '../services/api';

const SpeechRecognitionAPI =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export default function VoiceAgent() {
  const [callActive, setCallActive] = useState(false);
  const [callId, setCallId] = useState('');
  const [status, setStatus] = useState('Idle'); // Idle | Listening | Processing | Speaking
  const [language, setLanguage] = useState('en'); // en | hi
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const [consentGiven, setConsentGiven] = useState(true);

  const [messages, setMessages] = useState([]);
  const [textInput, setTextInput] = useState('');
  const [ragInfo, setRagInfo] = useState(null);
  const [memorySource, setMemorySource] = useState('');

  const [lead, setLead] = useState(null);
  const [qualifying, setQualifying] = useState(false);
  const [callStartTime, setCallStartTime] = useState(null);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  // Quick demo booking state
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [selectedSlot, setSelectedSlot] = useState('');
  const [bookingSuccess, setBookingSuccess] = useState('');

  const recognitionRef = useRef(null);
  const transcriptEndRef = useRef(null);
  const isSendingRef = useRef(false);
  const activeCallIdRef = useRef('');

  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    return () => {
      try {
        recognitionRef.current?.abort();
      } catch {
        // ignore cleanup errors
      }
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    getAppointments(bookingDate)
      .then((res) => setAvailableSlots(res.slotsForDate || []))
      .catch(() => {});
  }, [bookingDate]);

  // Speak AI text aloud using browser SpeechSynthesis
  const speakText = (text) => {
    if (!voiceEnabled || typeof window === 'undefined' || !window.speechSynthesis) {
      setStatus('Idle');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    utterance.rate = 1.0;

    setStatus('Speaking');
    utterance.onend = () => setStatus('Idle');
    utterance.onerror = () => setStatus('Idle');
    window.speechSynthesis.speak(utterance);
  };

  const startCall = () => {
    if (!consentGiven) {
      setError('Please confirm customer consent before starting and recording the call.');
      return;
    }
    const newCallId = `call_${Date.now()}`;
    activeCallIdRef.current = newCallId;
    isSendingRef.current = false;
    setCallId(newCallId);
    setCallActive(true);
    setCallStartTime(Date.now());
    setMessages([]);
    setLead(null);
    setRagInfo(null);
    setError('');
    setNotice('');
    setBookingSuccess('');

    const greeting =
      language === 'hi'
        ? 'नमस्ते! मैं VoxLead AI से बात कर रहा हूँ। आज मैं आपकी कंपनी के लिए कैसे मदद कर सकता हूँ?'
        : 'Hello! Welcome to VoxLead AI. How can I help you and your team today?';

    setMessages([{ role: 'assistant', text: greeting, timestamp: new Date().toISOString() }]);
    speakText(greeting);
  };

  const handleSendMessage = async (rawText) => {
    const trimmed = (rawText || '').trim();
    if (!trimmed || !callActive || isSendingRef.current) return;

    isSendingRef.current = true;
    const currentCallId = activeCallIdRef.current || callId;

    setError('');
    const customerMsg = { role: 'customer', text: trimmed, timestamp: new Date().toISOString() };
    const snapshotHistory = [...messages];
    setMessages((prev) => [...prev, customerMsg]);
    setTextInput('');
    setStatus('Processing');

    try {
      const data = await sendAIChat({
        callId: currentCallId,
        message: trimmed,
        language,
        fallbackHistory: snapshotHistory,
      });

      // Ignore stale response if the user ended or restarted the call while waiting
      if (activeCallIdRef.current !== currentCallId) return;

      const assistantMsg = {
        role: 'assistant',
        text: data.reply,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setRagInfo(data.rag || null);
      setMemorySource(data.memorySource || '');
      speakText(data.reply);
    } catch (err) {
      if (activeCallIdRef.current !== currentCallId) return;
      // Remove the failed customer message so the transcript stays clean, and restore it to input
      setMessages((prev) => prev.filter((m) => m !== customerMsg));
      setTextInput(trimmed);
      setStatus('Idle');
      setError(err.response?.data?.error || 'Failed to get AI response.');
    } finally {
      isSendingRef.current = false;
    }
  };

  const startListening = () => {
    if (!SpeechRecognitionAPI) {
      setError('Speech Recognition is not supported in this browser. Please use the text input below.');
      return;
    }
    if (!callActive || isSendingRef.current || status === 'Processing') return;

    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }

    window.speechSynthesis?.cancel();
    const recognition = new SpeechRecognitionAPI();
    recognition.lang = language === 'hi' ? 'hi-IN' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    let handledResult = false;

    recognition.onstart = () => {
      setStatus('Listening');
      setError('');
    };

    recognition.onresult = (event) => {
      if (handledResult) return;
      const result = event.results?.[event.resultIndex || 0];
      if (!result || !result.isFinal) return;
      handledResult = true;
      const spokenText = result[0]?.transcript || '';
      recognition.stop();
      handleSendMessage(spokenText);
    };

    recognition.onerror = (event) => {
      setStatus('Idle');
      if (event.error !== 'aborted') {
        setError(`Microphone error: ${event.error}. You can type your message below.`);
      }
    };

    recognition.onend = () => {
      setStatus((prev) => (prev === 'Listening' ? 'Idle' : prev));
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    recognitionRef.current?.stop();
    setStatus('Idle');
  };

  const handleQualifyLead = async () => {
    if (messages.length < 2) return null;
    setQualifying(true);
    try {
      const res = await qualifyLead({
        callId,
        transcript: messages,
        leadId: lead?._id || null,
      });
      setLead(res.lead);
      setNotice('Lead extracted, scored, and saved to MongoDB.');
      return res.lead;
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to qualify lead.');
      return null;
    } finally {
      setQualifying(false);
    }
  };

  const endCall = async () => {
    try {
      recognitionRef.current?.abort();
    } catch {
      // ignore
    }
    window.speechSynthesis?.cancel();
    activeCallIdRef.current = '';
    isSendingRef.current = false;
    setStatus('Processing');
    setError('');

    try {
      let savedLead = lead;
      if (messages.length >= 2) {
        savedLead = await handleQualifyLead();
      }

      const duration = callStartTime ? Math.round((Date.now() - callStartTime) / 1000) : 0;
      const callRes = await saveCall({
        callId,
        leadId: savedLead?._id || null,
        transcript: messages,
        duration,
        language,
      });

      setCallActive(false);
      setStatus('Idle');
      setNotice(
        callRes.backgroundJob?.queued
          ? 'Call saved to MongoDB, Redis memory cleared, and BullMQ summary job queued!'
          : 'Call saved to MongoDB and summarized!'
      );
    } catch (err) {
      setStatus('Idle');
      setCallActive(false);
      setError(err.response?.data?.error || 'Failed to save call.');
    }
  };

  const handleBookDemo = async (e) => {
    e.preventDefault();
    if (!selectedSlot) return;
    setBookingSuccess('');
    setError('');

    try {
      await createAppointment({
        leadId: lead?._id || null,
        customerName: lead?.name && lead.name !== 'Unknown Prospect' ? lead.name : 'Voice Call Prospect',
        customerEmail: lead?.email || '',
        company: lead?.company || '',
        date: bookingDate,
        time: selectedSlot,
        notes: `Booked during AI Voice Call (${callId || 'manual'})`,
      });
      setBookingSuccess(`Demo confirmed for ${bookingDate} at ${selectedSlot}`);
      setSelectedSlot('');
      const refreshed = await getAppointments(bookingDate);
      setAvailableSlots(refreshed.slotsForDate || []);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not book appointment.');
    }
  };

  const statusColors = {
    Idle: 'bg-slate-800 text-slate-300',
    Listening: 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 animate-pulse',
    Processing: 'bg-amber-500/20 text-amber-300 border border-amber-500/40',
    Speaking: 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40',
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Top Bar */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white">AI Voice Sales Agent</h2>
          <p className="text-sm text-slate-400">
            Powered by Groq LLM, Redis Conversation Memory, and Moderate RAG.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            disabled={callActive}
            className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-200 disabled:opacity-50"
          >
            <option value="en">English (US)</option>
            <option value="hi">Hindi (हिन्दी)</option>
          </select>

          <button
            onClick={() => setVoiceEnabled(!voiceEnabled)}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-900 border border-slate-700 text-sm text-slate-300 hover:bg-slate-800 cursor-pointer"
          >
            {voiceEnabled ? <Volume2 className="w-4 h-4 text-indigo-400" /> : <VolumeX className="w-4 h-4 text-slate-500" />}
            {voiceEnabled ? 'Voice On' : 'Muted'}
          </button>

          <span className={`px-3 py-1.5 rounded-full text-xs font-semibold ${statusColors[status]}`}>
            Status: {status}
          </span>
        </div>
      </div>

      {/* Consent & Controls */}
      <div className="p-4 rounded-2xl bg-slate-900/70 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <label className="flex items-center gap-2.5 text-xs text-slate-300 cursor-pointer">
          <input
            type="checkbox"
            checked={consentGiven}
            onChange={(e) => setConsentGiven(e.target.checked)}
            disabled={callActive}
            className="rounded border-slate-600 bg-slate-800 text-indigo-500"
          />
          <span>Customer consents to AI voice interaction and transcript storage.</span>
        </label>

        <div className="flex items-center gap-3">
          {!callActive ? (
            <button
              onClick={startCall}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold shadow-lg shadow-emerald-500/20 transition cursor-pointer"
            >
              <PhoneCall className="w-4 h-4" />
              Start Call
            </button>
          ) : (
            <>
              <button
                onClick={status === 'Listening' ? stopListening : startListening}
                disabled={status === 'Processing'}
                className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
                  status === 'Listening'
                    ? 'bg-amber-600 hover:bg-amber-500 text-white'
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                }`}
              >
                {status === 'Listening' ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
                {status === 'Listening' ? 'Stop Mic' : 'Speak'}
              </button>

              <button
                onClick={endCall}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-sm font-semibold transition cursor-pointer"
              >
                <PhoneOff className="w-4 h-4" />
                End Call
              </button>
            </>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {notice && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          {notice}
        </div>
      )}

      {/* Main 2-column Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 cols: Transcript & Text Fallback */}
        <div className="lg:col-span-2 flex flex-col h-[540px] rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-800/80 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              Live Call Transcript
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              {memorySource && (
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  Memory: {memorySource}
                </span>
              )}
              {ragInfo && (
                <span className="px-2 py-0.5 rounded bg-indigo-500/15 text-indigo-300">
                  RAG: {ragInfo.method} ({ragInfo.chunksUsed} chunks)
                </span>
              )}
            </div>
          </div>

          <div className="flex-1 p-5 overflow-y-auto space-y-4">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500 space-y-2">
                <PhoneCall className="w-10 h-10 text-slate-700" />
                <p className="text-sm">Click &ldquo;Start Call&rdquo; to begin a sales conversation.</p>
                <p className="text-xs max-w-md">
                  Try saying: &ldquo;Hi, I need HR software for my company of 50 employees.&rdquo;
                </p>
              </div>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  className={`flex ${m.role === 'customer' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                      m.role === 'customer'
                        ? 'bg-indigo-600 text-white rounded-br-sm'
                        : 'bg-slate-800/90 text-slate-100 border border-slate-700/70 rounded-bl-sm'
                    }`}
                  >
                    <p className="text-[10px] uppercase tracking-wider opacity-70 mb-1">
                      {m.role === 'customer' ? 'Customer' : 'VoxLead AI'}
                    </p>
                    <p>{m.text}</p>
                  </div>
                </div>
              ))
            )}
            <div ref={transcriptEndRef} />
          </div>

          {/* Text Input Fallback */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSendMessage(textInput);
            }}
            className="p-3.5 border-t border-slate-800/80 bg-slate-950/60 flex items-center gap-2"
          >
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              disabled={!callActive || status === 'Processing'}
              placeholder={
                callActive
                  ? 'Type a message (text fallback if microphone is unavailable)...'
                  : 'Start a call to send messages...'
              }
              className="flex-1 px-4 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
            />
            <button
              type="submit"
              disabled={!callActive || !textInput.trim() || status === 'Processing'}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-40 cursor-pointer"
              aria-label="Send message"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>

        {/* Right Col: Lead Qualification + Quick Demo Booking */}
        <div className="space-y-6">
          {/* Lead Panel */}
          <div className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
                <UserCheck className="w-4 h-4 text-emerald-400" />
                Live Lead Qualification
              </h3>
              <button
                onClick={handleQualifyLead}
                disabled={messages.length < 2 || qualifying}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-indigo-300 border border-slate-700 disabled:opacity-40 cursor-pointer"
              >
                {qualifying ? 'Extracting...' : 'Extract Lead'}
              </button>
            </div>

            {!lead ? (
              <p className="text-xs text-slate-500">
                Lead details will be extracted automatically when the call ends, or click &ldquo;Extract Lead&rdquo; anytime.
              </p>
            ) : (
              <div className="space-y-2.5 text-xs">
                <div className="flex items-center justify-between pb-2 border-b border-slate-800">
                  <span className="text-slate-400">Score &amp; Status</span>
                  <span className="font-semibold text-white">
                    {lead.leadScore}/100 •{' '}
                    <span
                      className={
                        lead.leadStatus === 'Hot'
                          ? 'text-rose-400'
                          : lead.leadStatus === 'Warm'
                            ? 'text-amber-400'
                            : 'text-cyan-400'
                      }
                    >
                      {lead.leadStatus}
                    </span>
                  </span>
                </div>
                <div className="flex justify-between"><span className="text-slate-400">Name:</span><span className="text-slate-200">{lead.name || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Company:</span><span className="text-slate-200">{lead.company || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Employees:</span><span className="text-slate-200">{lead.employees || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Budget:</span><span className="text-slate-200">{lead.budget || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Timeline:</span><span className="text-slate-200">{lead.purchaseTimeline || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Email:</span><span className="text-slate-200">{lead.email || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Phone:</span><span className="text-slate-200">{lead.phone || '—'}</span></div>
              </div>
            )}
          </div>

          {/* Quick Demo Slot Booking */}
          <form
            onSubmit={handleBookDemo}
            className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-3"
          >
            <h3 className="font-semibold text-white flex items-center gap-2 text-sm">
              <CalendarCheck className="w-4 h-4 text-violet-400" />
              Book Demo Slot
            </h3>
            <input
              type="date"
              value={bookingDate}
              onChange={(e) => setBookingDate(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-200"
            />
            <div className="grid grid-cols-2 gap-2">
              {availableSlots.map((slot) => (
                <button
                  type="button"
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedSlot(slot.time)}
                  className={`px-2.5 py-2 rounded-lg text-xs font-medium border transition cursor-pointer ${
                    !slot.available
                      ? 'bg-slate-950 border-slate-800 text-slate-600 line-through cursor-not-allowed'
                      : selectedSlot === slot.time
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-indigo-500/50'
                  }`}
                >
                  {slot.time}
                </button>
              ))}
            </div>
            <button
              type="submit"
              disabled={!selectedSlot}
              className="w-full py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-semibold disabled:opacity-40 cursor-pointer"
            >
              Confirm Demo Slot
            </button>
            {bookingSuccess && (
              <p className="text-xs text-emerald-400">{bookingSuccess}</p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}
