const mongoose = require('mongoose');

/**
 * Chunk Sub-schema
 * Stores each text chunk alongside its vector embedding (array of numbers)
 * so our Moderate RAG system can run cosine similarity in JavaScript.
 */
const chunkSchema = new mongoose.Schema(
  {
    chunkIndex: {
      type: Number,
      required: true,
    },
    text: {
      type: String,
      required: true,
    },
    embedding: {
      type: [Number],
      default: [],
    },
  },
  { _id: false }
);

/**
 * KnowledgeDocument Schema
 * Stores uploaded PDF/TXT company documents, their extracted text, and embedded chunks.
 */
const knowledgeDocumentSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
      trim: true,
    },
    fileType: {
      type: String,
      enum: ['pdf', 'txt'],
      required: true,
    },
    fileSize: {
      type: Number,
      default: 0,
    },
    content: {
      type: String,
      required: true,
    },
    chunks: {
      type: [chunkSchema],
      default: [],
    },
    embeddingStatus: {
      type: String,
      enum: ['embedded', 'keyword_fallback', 'failed'],
      default: 'embedded',
    },
    embeddingModel: {
      type: String,
      default: 'gemini-embedding-001',
    },
    embeddingError: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model('KnowledgeDocument', knowledgeDocumentSchema);
