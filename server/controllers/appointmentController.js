const Appointment = require('../models/Appointment');
const { invalidateDashboardCache } = require('../services/cacheService');

const STANDARD_SLOTS = ['10:00 AM', '11:30 AM', '02:00 PM', '03:30 PM', '05:00 PM'];

/**
 * GET /api/appointments
 * Returns all appointments plus available slots for a given date (default: today).
 */
async function getAppointments(req, res) {
  try {
    const selectedDate = req.query.date || new Date().toISOString().split('T')[0];

    const appointments = await Appointment.find()
      .populate('leadId', 'name company email phone')
      .sort({ date: 1, time: 1 })
      .lean();

    const bookedForDate = new Set(
      appointments
        .filter((a) => a.date === selectedDate && a.status !== 'Cancelled')
        .map((a) => a.time)
    );

    const slotsForDate = STANDARD_SLOTS.map((time) => ({
      time,
      available: !bookedForDate.has(time),
    }));

    return res.json({
      appointments,
      selectedDate,
      slotsForDate,
    });
  } catch (error) {
    console.error('[AppointmentController] getAppointments error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch appointments.' });
  }
}

/**
 * POST /api/appointments
 * Books a new demo slot and prevents double-booking.
 */
async function createAppointment(req, res) {
  try {
    const { leadId = null, customerName, customerEmail = '', company = '', date, time, notes = '' } = req.body;

    if (!customerName || !date || !time) {
      return res.status(400).json({
        error: 'customerName, date, and time are required to book an appointment.',
      });
    }

    // Check if slot is already reserved
    const existing = await Appointment.findOne({
      date,
      time,
      status: { $ne: 'Cancelled' },
    });

    if (existing) {
      return res.status(409).json({
        error: `Slot ${date} at ${time} is already booked. Please choose another time.`,
      });
    }

    const appointment = await Appointment.create({
      leadId: leadId || null,
      customerName,
      customerEmail,
      company,
      date,
      time,
      notes,
      status: 'Confirmed',
    });

    await invalidateDashboardCache();
    return res.status(201).json({ appointment });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'This appointment slot is already reserved.',
      });
    }
    console.error('[AppointmentController] createAppointment error:', error.message);
    return res.status(500).json({ error: 'Failed to book appointment.' });
  }
}

/**
 * PUT /api/appointments/:id
 */
async function updateAppointment(req, res) {
  try {
    const appointment = await Appointment.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!appointment) {
      return res.status(404).json({ error: 'Appointment not found.' });
    }

    await invalidateDashboardCache();
    return res.json({ appointment });
  } catch (error) {
    console.error('[AppointmentController] updateAppointment error:', error.message);
    return res.status(500).json({ error: 'Failed to update appointment.' });
  }
}

module.exports = {
  getAppointments,
  createAppointment,
  updateAppointment,
};
