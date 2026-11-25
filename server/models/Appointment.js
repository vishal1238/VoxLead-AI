const mongoose = require('mongoose');

/**
 * Appointment Schema
 * Stores product demonstration bookings and prevents double-booking of the same date + time.
 */
const appointmentSchema = new mongoose.Schema(
  {
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    customerName: {
      type: String,
      required: true,
      trim: true,
    },
    customerEmail: {
      type: String,
      default: '',
      trim: true,
    },
    company: {
      type: String,
      default: '',
      trim: true,
    },
    date: {
      type: String, // Format: YYYY-MM-DD
      required: true,
    },
    time: {
      type: String, // Example: "10:00 AM"
      required: true,
    },
    status: {
      type: String,
      enum: ['Confirmed', 'Completed', 'Cancelled'],
      default: 'Confirmed',
    },
    notes: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

// Prevent double-booking active appointments for the same date and time
appointmentSchema.index(
  { date: 1, time: 1 },
  {
    unique: true,
    partialFilterExpression: { status: { $ne: 'Cancelled' } },
  }
);

module.exports = mongoose.model('Appointment', appointmentSchema);
