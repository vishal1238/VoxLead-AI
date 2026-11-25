const mongoose = require('mongoose');

/**
 * Message Sub-schema for storing each turn of a voice/text call transcript.
 */
const messageSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      enum: ['customer', 'assistant'],
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    timestamp: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

/**
 * Call Schema
 * Stores the completed call transcript, AI summary, sentiment, and BullMQ job status.
 */
const callSchema = new mongoose.Schema(
  {
    callId: {
      type: String,
      required: true,
      unique: true,
      index: true,
    },
    leadId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lead',
      default: null,
    },
    transcript: {
      type: [messageSchema],
      default: [],
    },
    summary: {
      type: String,
      default: '',
    },
    requirements: {
      type: [String],
      default: [],
    },
    objections: {
      type: [String],
      default: [],
    },
    purchaseIntent: {
      type: String,
      default: 'Unknown',
    },
    nextAction: {
      type: String,
      default: '',
    },
    sentiment: {
      type: String,
      enum: ['Positive', 'Neutral', 'Negative'],
      default: 'Neutral',
    },
    duration: {
      type: Number, // Duration in seconds
      default: 0,
    },
    language: {
      type: String,
      enum: ['en', 'hi'],
      default: 'en',
    },
    analysisStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed'],
      default: 'pending',
    },
    analysisError: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('Call', callSchema);
