const mongoose = require('mongoose');

/**
 * Lead Schema
 * Stores qualified customer details, buying intent, and lead score in MongoDB.
 */
const leadSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      default: 'Unknown Prospect',
      trim: true,
    },
    email: {
      type: String,
      default: '',
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      default: '',
      trim: true,
    },
    company: {
      type: String,
      default: '',
      trim: true,
    },
    employees: {
      type: String,
      default: '',
      trim: true,
    },
    budget: {
      type: String,
      default: '',
      trim: true,
    },
    productInterest: {
      type: String,
      default: '',
      trim: true,
    },
    purchaseTimeline: {
      type: String,
      default: '',
      trim: true,
    },
    buyingIntent: {
      type: String,
      enum: ['High', 'Medium', 'Low', 'Unknown'],
      default: 'Unknown',
    },
    leadScore: {
      type: Number,
      min: 0,
      max: 100,
      default: 20,
    },
    leadStatus: {
      type: String,
      enum: ['Hot', 'Warm', 'Cold'],
      default: 'Cold',
    },
    sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative'],
      default: 'Neutral',
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

module.exports = mongoose.model('Lead', leadSchema);
