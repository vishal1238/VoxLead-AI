const pdfParse = require('pdf-parse');
const KnowledgeDocument = require('../models/KnowledgeDocument');
const { splitTextIntoChunks } = require('../utils/textChunker');
const { generateEmbedding, DEFAULT_HF_MODEL } = require('../services/embeddingService');

/**
 * POST /api/knowledge/upload
 * Uploads a PDF or TXT file, extracts text, splits into ~650-char overlapping chunks,
 * generates embeddings via Hugging Face API, and stores everything in MongoDB.
 */
async function uploadDocument(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Please upload a PDF or TXT file.' });
    }

    const { originalname, mimetype, size, buffer } = req.file;
    const lowerName = originalname.toLowerCase();

    let fileType = '';
    if (lowerName.endsWith('.pdf') || mimetype === 'application/pdf') {
      fileType = 'pdf';
    } else if (lowerName.endsWith('.txt') || mimetype === 'text/plain') {
      fileType = 'txt';
    } else {
      return res.status(400).json({ error: 'Only .pdf and .txt files are supported.' });
    }

    // Extract text
    let extractedText = '';
    if (fileType === 'pdf') {
      const pdfData = await pdfParse(buffer);
      extractedText = pdfData.text || '';
    } else {
      extractedText = buffer.toString('utf-8');
    }

    if (!extractedText || !extractedText.trim()) {
      return res.status(400).json({
        error: 'No readable text could be extracted from this file.',
      });
    }

    // Split text into chunks (~650 chars with 100 char overlap)
    const rawChunks = splitTextIntoChunks(extractedText, 650, 100);
    if (rawChunks.length === 0) {
      return res.status(400).json({ error: 'Document produced zero text chunks.' });
    }

    // Generate embeddings for each chunk
    const embeddedChunks = [];
    let embeddingFailed = false;
    let lastEmbeddingError = '';

    for (const chunk of rawChunks) {
      if (!embeddingFailed) {
        const result = await generateEmbedding(chunk.text);
        if (result.success && result.embedding) {
          embeddedChunks.push({
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            embedding: result.embedding,
          });
        } else {
          // Stop calling HF for remaining chunks if the API key is missing or failed
          embeddingFailed = true;
          lastEmbeddingError = result.error || 'Embedding generation failed';
          embeddedChunks.push({
            chunkIndex: chunk.chunkIndex,
            text: chunk.text,
            embedding: [],
          });
        }
      } else {
        embeddedChunks.push({
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          embedding: [],
        });
      }
    }

    const embeddingStatus = embeddingFailed ? 'keyword_fallback' : 'embedded';

    const doc = await KnowledgeDocument.create({
      filename: originalname,
      fileType,
      fileSize: size,
      content: extractedText,
      chunks: embeddedChunks,
      embeddingStatus,
      embeddingModel: DEFAULT_HF_MODEL,
      embeddingError: lastEmbeddingError,
    });

    return res.status(201).json({
      document: {
        _id: doc._id,
        filename: doc.filename,
        fileType: doc.fileType,
        fileSize: doc.fileSize,
        chunkCount: doc.chunks.length,
        embeddingStatus: doc.embeddingStatus,
        embeddingError: doc.embeddingError,
        createdAt: doc.createdAt,
      },
    });
  } catch (error) {
    console.error('[KnowledgeController] uploadDocument error:', error.message);
    return res.status(500).json({ error: error.message || 'Failed to process document.' });
  }
}

/**
 * GET /api/knowledge
 * Returns all uploaded knowledge base documents (without raw embedding vectors).
 */
async function getDocuments(req, res) {
  try {
    const docs = await KnowledgeDocument.find({}, '-chunks.embedding -content')
      .sort({ createdAt: -1 })
      .lean();

    const formatted = docs.map((doc) => ({
      _id: doc._id,
      filename: doc.filename,
      fileType: doc.fileType,
      fileSize: doc.fileSize,
      chunkCount: doc.chunks ? doc.chunks.length : 0,
      embeddingStatus: doc.embeddingStatus,
      embeddingModel: doc.embeddingModel,
      embeddingError: doc.embeddingError,
      createdAt: doc.createdAt,
    }));

    return res.json({ documents: formatted });
  } catch (error) {
    console.error('[KnowledgeController] getDocuments error:', error.message);
    return res.status(500).json({ error: 'Failed to fetch documents.' });
  }
}

/**
 * DELETE /api/knowledge/:id
 */
async function deleteDocument(req, res) {
  try {
    const deleted = await KnowledgeDocument.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Document not found.' });
    }
    return res.json({ message: 'Document deleted successfully.' });
  } catch (error) {
    console.error('[KnowledgeController] deleteDocument error:', error.message);
    return res.status(500).json({ error: 'Failed to delete document.' });
  }
}

module.exports = {
  uploadDocument,
  getDocuments,
  deleteDocument,
};
