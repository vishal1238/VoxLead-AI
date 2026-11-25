/**
 * Calculates Cosine Similarity between two numeric embedding vectors.
 * Returns a value between -1 and 1 (higher means more semantically similar).
 *
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number}
 */
function cosineSimilarity(vecA, vecB) {
  if (!Array.isArray(vecA) || !Array.isArray(vecB) || vecA.length === 0 || vecA.length !== vecB.length) {
    return 0;
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i += 1) {
    const a = vecA[i];
    const b = vecB[i];
    dotProduct += a * b;
    normA += a * a;
    normB += b * b;
  }

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Simple keyword-overlap fallback scorer used ONLY when the embedding API is unavailable.
 * Returns a score between 0 and 1 based on matching words.
 *
 * @param {string} query
 * @param {string} text
 * @returns {number}
 */
function keywordSimilarity(query, text) {
  if (!query || !text) return 0;

  const stopWords = new Set([
    'the', 'is', 'at', 'which', 'on', 'a', 'an', 'and', 'or', 'for', 'to', 'of',
    'in', 'with', 'what', 'how', 'much', 'your', 'you', 'do', 'does', 'are', 'can',
    'tell', 'me', 'about', 'have', 'this', 'that', 'it', 'we', 'our',
  ]);

  const queryWords = query
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));

  if (queryWords.length === 0) return 0;

  const lowerText = text.toLowerCase();
  let matches = 0;

  for (const word of queryWords) {
    if (lowerText.includes(word)) {
      matches += 1;
    }
  }

  return matches / queryWords.length;
}

module.exports = {
  cosineSimilarity,
  keywordSimilarity,
};
