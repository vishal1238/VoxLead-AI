/**
 * Splits a long document string into smaller overlapping chunks.
 * Overlap helps preserve context across chunk boundaries.
 *
 * @param {string} text - Full extracted document text
 * @param {number} chunkSize - Target characters per chunk (500-800 recommended)
 * @param {number} overlap - Number of overlapping characters between chunks
 * @returns {Array<{ chunkIndex: number, text: string }>}
 */
function splitTextIntoChunks(text, chunkSize = 650, overlap = 100) {
  if (!text || typeof text !== 'string') {
    return [];
  }

  // Normalize whitespace so chunks are clean and readable
  const cleaned = text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();

  if (!cleaned) {
    return [];
  }

  if (cleaned.length <= chunkSize) {
    return [{ chunkIndex: 0, text: cleaned }];
  }

  const chunks = [];
  let start = 0;
  let chunkIndex = 0;

  while (start < cleaned.length) {
    let end = Math.min(start + chunkSize, cleaned.length);

    // Try to avoid cutting in the middle of a word if we are not at the end
    if (end < cleaned.length) {
      const lastPeriod = cleaned.lastIndexOf('. ', end);
      const lastNewline = cleaned.lastIndexOf('\n', end);
      const lastSpace = cleaned.lastIndexOf(' ', end);

      const bestBreak = Math.max(lastPeriod + 1, lastNewline, lastSpace);
      if (bestBreak > start + Math.floor(chunkSize * 0.5)) {
        end = bestBreak;
      }
    }

    const chunkText = cleaned.slice(start, end).trim();
    if (chunkText) {
      chunks.push({
        chunkIndex,
        text: chunkText,
      });
      chunkIndex += 1;
    }

    if (end >= cleaned.length) {
      break;
    }

    // Move forward while keeping `overlap` characters from the previous chunk
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

module.exports = {
  splitTextIntoChunks,
};
