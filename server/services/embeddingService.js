const axios = require('axios');

const DEFAULT_HF_MODEL = 'sentence-transformers/all-MiniLM-L6-v2';
const HF_EMBEDDING_URL =
  process.env.HUGGINGFACE_EMBEDDING_URL ||
  `https://router.huggingface.co/hf-inference/models/${DEFAULT_HF_MODEL}/pipeline/feature-extraction`;

/**
 * Generates a vector embedding for a given text string using the Hugging Face Inference API.
 * Reads HUGGINGFACE_API_KEY from environment variables.
 *
 * Never pretends embedding succeeded if the key is missing or the API fails.
 *
 * @param {string} text
 * @returns {Promise<{ success: boolean, embedding: number[] | null, error: string | null }>}
 */
async function generateEmbedding(text) {
  const apiKey = process.env.HUGGINGFACE_API_KEY;

  if (!apiKey || apiKey === 'your_huggingface_api_key_here') {
    return {
      success: false,
      embedding: null,
      error: 'HUGGINGFACE_API_KEY is not configured in .env',
    };
  }

  if (!text || !text.trim()) {
    return {
      success: false,
      embedding: null,
      error: 'Cannot generate embedding for empty text',
    };
  }

  try {
    const response = await axios.post(
      HF_EMBEDDING_URL,
      {
        inputs: text.slice(0, 2000),
        options: { wait_for_model: true },
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        timeout: 20000,
      }
    );

    const data = response.data;

    // Hugging Face may return [number[]] or number[] depending on model pipeline
    let vector = null;
    if (Array.isArray(data) && typeof data[0] === 'number') {
      vector = data;
    } else if (Array.isArray(data) && Array.isArray(data[0]) && typeof data[0][0] === 'number') {
      vector = data[0];
    }

    if (!vector || vector.length === 0) {
      return {
        success: false,
        embedding: null,
        error: 'Unexpected embedding response format from Hugging Face API',
      };
    }

    return {
      success: true,
      embedding: vector,
      error: null,
    };
  } catch (error) {
    const message = error.response?.data?.error || error.message;
    console.error(`[EmbeddingService] Hugging Face API error: ${message}`);
    return {
      success: false,
      embedding: null,
      error: message,
    };
  }
}

module.exports = {
  generateEmbedding,
  DEFAULT_HF_MODEL,
};
