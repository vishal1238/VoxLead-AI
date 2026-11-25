import { useEffect, useState } from 'react';
import { Calendar, Clock, CheckCircle2, XCircle } from 'lucide-react';
import { getAppointments, createAppointment, updateAppointment } from '../services/api';

export default function Appointments() {
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [slots, setSlots] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [selectedTime, setSelectedTime] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [company, setCompany] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const loadData = async (date) => {
    try {
      const data = await getAppointments(date);
      setSlots(data.slotsForDate || []);
      setAppointments(data.appointments || []);
    } catch (err) {
      setError('Failed to load appointments.');
    }
  };

  useEffect(() => {
    loadData(selectedDate);
  }, [selectedDate]);

  const handleBook = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!customerName.trim() || !selectedTime) {
      setError('Please enter a customer name and select an available slot.');
      return;
    }

    try {
      await createAppointment({
        customerName: customerName.trim(),
        customerEmail: customerEmail.trim(),
        company: company.trim(),
        date: selectedDate,
        time: selectedTime,
      });
      setSuccess(`Appointment confirmed for ${selectedDate} at ${selectedTime}.`);
      setCustomerName('');
      setCustomerEmail('');
      setCompany('');
      setSelectedTime('');
      loadData(selectedDate);
    } catch (err) {
      setError(err.response?.data?.error || 'Could not book appointment.');
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await updateAppointment(id, { status });
      loadData(selectedDate);
    } catch (err) {
      setError('Failed to update appointment status.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-white">Demo Appointments</h2>
        <p className="text-sm text-slate-400">
          Manage product demonstration slots and prevent double-booking.
        </p>
      </div>

      {error && (
        <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-sm">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-sm">
          {success}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Book a Slot */}
        <form
          onSubmit={handleBook}
          className="p-5 rounded-2xl bg-slate-900/70 border border-slate-800/80 space-y-4"
        >
          <h3 className="font-semibold text-white flex items-center gap-2">
            <Calendar className="w-4 h-4 text-indigo-400" />
            Book Demonstration
          </h3>

          <div>
            <label className="block text-xs text-slate-400 mb-1">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setSelectedTime('');
              }}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
            />
          </div>

          <div>
            <label className="block text-xs text-slate-400 mb-1.5">Available Slots</label>
            <div className="grid grid-cols-2 gap-2">
              {slots.map((slot) => (
                <button
                  type="button"
                  key={slot.time}
                  disabled={!slot.available}
                  onClick={() => setSelectedTime(slot.time)}
                  className={`px-3 py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                    !slot.available
                      ? 'bg-slate-950 border-slate-800 text-slate-600 line-through cursor-not-allowed'
                      : selectedTime === slot.time
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-slate-950 border-slate-700 text-slate-300 hover:border-indigo-500/50'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {slot.time}
                </button>
              ))}
            </div>
          </div>

          <input
            type="text"
            placeholder="Customer Name *"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <input
            type="email"
            placeholder="Customer Email"
            value={customerEmail}
            onChange={(e) => setCustomerEmail(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />
          <input
            type="text"
            placeholder="Company Name"
            value={company}
            onChange={(e) => setCompany(e.target.value)}
            className="w-full px-3.5 py-2 rounded-xl bg-slate-950 border border-slate-700 text-sm text-white"
          />

          <button
            type="submit"
            className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold cursor-pointer"
          >
            Confirm Booking
          </button>
        </form>

        {/* Appointments List */}
        <div className="lg:col-span-2 rounded-2xl bg-slate-900/70 border border-slate-800/80 overflow-x-auto">
          <div className="px-5 py-4 border-b border-slate-800">
            <h3 className="font-semibold text-white">Scheduled Appointments</h3>
          </div>
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-800 text-xs uppercase text-slate-400">
              <tr>
                <th className="px-5 py-3">Customer</th>
                <th className="px-5 py-3">Date &amp; Time</th>
                <th className="px-5 py-3">Status</th>
                <th className="px-5 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70">
              {appointments.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-5 py-8 text-center text-slate-500">
                    No appointments scheduled yet.
                  </td>
                </tr>
              ) : (
                appointments.map((apt) => (
                  <tr key={apt._id} className="hover:bg-slate-800/40">
                    <td className="px-5 py-3.5">
                      <div className="font-medium text-white">{apt.customerName}</div>
                      <div className="text-xs text-slate-400">
                        {apt.company || apt.customerEmail || '—'}
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-slate-300">
                      {apt.date} • {apt.time}
                    </td>
                    <td className="px-5 py-3.5">
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          apt.status === 'Confirmed'
                            ? 'bg-indigo-500/15 text-indigo-300'
                            : apt.status === 'Completed'
                              ? 'bg-emerald-500/15 text-emerald-300'
                              : 'bg-rose-500/15 text-rose-300'
                        }`}
                      >
                        {apt.status}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right space-x-2">
                      {apt.status === 'Confirmed' && (
                        <>
                          <button
                            onClick={() => handleStatusChange(apt._id, 'Completed')}
                            className="p-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 cursor-pointer"
                            title="Mark Completed"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleStatusChange(apt._id, 'Cancelled')}
                            className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer"
                            title="Cancel Appointment"
                          >
                            <XCircle className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
