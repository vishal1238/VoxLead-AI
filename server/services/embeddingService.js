const axios = require('axios');

const DEFAULT_EMBEDDING_MODEL = 'gemini-embedding-001';

/**
 * Generates a vector embedding for a given text string using Google's Gemini Embeddings API.
 * Reads GEMINI_API_KEY from environment variables.
 *
 * Never pretends embedding succeeded if the key is missing or the API fails.
 *
 * @param {string} text
 * @returns {Promise<{ success: boolean, embedding: number[] | null, error: string | null }>}
 */
async function generateEmbedding(text) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    return {
      success: false,
      embedding: null,
      error: 'GEMINI_API_KEY is not configured in .env',
    };
  }

  if (!text || !text.trim()) {
    return {
      success: false,
      embedding: null,
      error: 'Cannot generate embedding for empty text',
    };
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${DEFAULT_EMBEDDING_MODEL}:embedContent?key=${apiKey}`;

  try {
    const response = await axios.post(
      url,
      {
        model: `models/${DEFAULT_EMBEDDING_MODEL}`,
        content: {
          parts: [{ text: text.slice(0, 4000) }],
        },
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const vector = response.data?.embedding?.values;

    if (!Array.isArray(vector) || vector.length === 0) {
      return {
        success: false,
        embedding: null,
        error: 'Unexpected embedding response format from Gemini API',
      };
    }

    return {
      success: true,
      embedding: vector,
      error: null,
    };
  } catch (error) {
    const message = error.response?.data?.error?.message || error.message;
    console.error(`[EmbeddingService] Gemini API error: ${message}`);
    return {
      success: false,
      embedding: null,
      error: message,
    };
  }
}

module.exports = {
  generateEmbedding,
  DEFAULT_EMBEDDING_MODEL,
};
