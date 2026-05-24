function estimateTokens(text) {
  const raw = String(text || '');
  if (!raw) return 0;
  return Math.max(1, Math.ceil(raw.length / 4));
}

function chunkText(text, options = {}) {
  const minTokens = Number.isFinite(options.minTokens) ? options.minTokens : 500;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 1500;
  const maxChunks = Number.isFinite(options.maxChunks) ? Math.max(1, options.maxChunks) : 0;
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const chunks = [];
  let buffer = [];
  let bufferTokens = 0;
  let chunkId = 1;

  const flush = () => {
    if (!buffer.length) return;
    const chunkTextValue = buffer.join(' ').trim();
    if (chunkTextValue) {
      chunks.push({
        chunkId,
        text: chunkTextValue,
        tokenEstimate: estimateTokens(chunkTextValue)
      });
      chunkId += 1;
    }
    buffer = [];
    bufferTokens = 0;
  };

  if (maxChunks) {
    const perChunk = Math.ceil(words.length / maxChunks);
    for (let i = 0; i < words.length; i += perChunk) {
      const slice = words.slice(i, i + perChunk).join(' ').trim();
      if (!slice) continue;
      chunks.push({
        chunkId,
        text: slice,
        tokenEstimate: estimateTokens(slice)
      });
      chunkId += 1;
    }
    return chunks;
  }

  for (const word of words) {
    const nextBuffer = buffer.concat(word).join(' ');
    const nextTokens = estimateTokens(nextBuffer);
    if (buffer.length && nextTokens > maxTokens) {
      flush();
      buffer.push(word);
      bufferTokens = estimateTokens(word);
      continue;
    }
    buffer.push(word);
    bufferTokens = nextTokens;
    if (bufferTokens >= minTokens) {
      flush();
    }
  }

  flush();
  return chunks;
}

module.exports = {
  chunkText,
  estimateTokens
};
