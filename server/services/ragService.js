const KnowledgeDocument = require('../models/KnowledgeDocument');
const { generateEmbedding } = require('./embeddingService');
const { cosineSimilarity, keywordSimilarity } = require('../utils/similarity');

const EMBEDDING_SIMILARITY_THRESHOLD = 0.25;
const KEYWORD_SIMILARITY_THRESHOLD = 0.2;

/**
 * Searches the MongoDB Knowledge Base for the top K most relevant chunks
 * for a customer's question.
 *
 * Primary method: Embedding + Cosine Similarity (Moderate RAG).
 * Fallback method: Keyword overlap when the embedding API is unavailable or chunks lack embeddings.
 *
 * @param {string} question - Customer's spoken/typed message
 * @param {number} topK - Number of top chunks to return (default: 3)
 * @returns {Promise<{ method: string, chunks: Array, error: string | null }>}
 */
async function retrieveRelevantChunks(question, topK = 3) {
  if (!question || !question.trim()) {
    return { method: 'none', chunks: [], error: null };
  }

  const documents = await KnowledgeDocument.find({}, 'filename chunks embeddingStatus').lean();

  if (!documents || documents.length === 0) {
    return { method: 'none', chunks: [], error: 'No knowledge base documents uploaded.' };
  }

  // Flatten all chunks across documents
  const allChunks = [];
  for (const doc of documents) {
    for (const chunk of doc.chunks || []) {
      allChunks.push({
        documentId: doc._id,
        filename: doc.filename,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        embedding: chunk.embedding || [],
      });
    }
  }

  if (allChunks.length === 0) {
    return { method: 'none', chunks: [], error: 'Uploaded documents contain no text chunks.' };
  }

  // Check if we have stored embeddings to compare against
  const chunksWithEmbeddings = allChunks.filter((c) => Array.isArray(c.embedding) && c.embedding.length > 0);

  if (chunksWithEmbeddings.length > 0) {
    const queryEmbeddingResult = await generateEmbedding(question);

    if (queryEmbeddingResult.success && queryEmbeddingResult.embedding) {
      const scored = chunksWithEmbeddings
        .map((chunk) => ({
          filename: chunk.filename,
          chunkIndex: chunk.chunkIndex,
          text: chunk.text,
          score: cosineSimilarity(queryEmbeddingResult.embedding, chunk.embedding),
        }))
        .filter((item) => item.score >= EMBEDDING_SIMILARITY_THRESHOLD)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);

      return {
        method: 'embedding',
        chunks: scored,
        error: null,
      };
    }

    // Embedding API failed for the query — explicitly fall back to keyword search
    console.warn(
      `[RAG] Embedding API unavailable (${queryEmbeddingResult.error}). Falling back to keyword retrieval.`
    );
    const keywordScored = allChunks
      .map((chunk) => ({
        filename: chunk.filename,
        chunkIndex: chunk.chunkIndex,
        text: chunk.text,
        score: keywordSimilarity(question, chunk.text),
      }))
      .filter((item) => item.score >= KEYWORD_SIMILARITY_THRESHOLD)
      .sort((a, b) => b.score - a.score)
      .slice(0, topK);

    return {
      method: 'keyword_fallback',
      chunks: keywordScored,
      error: queryEmbeddingResult.error,
    };
  }

  // Documents were saved without embeddings (e.g., uploaded while HF key was missing)
  const keywordScored = allChunks
    .map((chunk) => ({
      filename: chunk.filename,
      chunkIndex: chunk.chunkIndex,
      text: chunk.text,
      score: keywordSimilarity(question, chunk.text),
    }))
    .filter((item) => item.score >= KEYWORD_SIMILARITY_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

  return {
    method: 'keyword_fallback',
    chunks: keywordScored,
    error: 'Document chunks do not have vector embeddings stored.',
  };
}

module.exports = {
  retrieveRelevantChunks,
};
