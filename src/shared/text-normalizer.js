function normalizeText(value, options = {}) {
  const { stripNonAlnum = false, collapseSpaces = true } = options;
  let text = String(value || '');
  if (!text) return '';
  text = text
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  if (stripNonAlnum) {
    text = text.replace(/[^\p{L}\p{N}]+/gu, '');
  } else {
    text = text.replace(/[^\p{L}\p{N}]+/gu, ' ');
  }
  if (collapseSpaces) {
    text = text.trim().replace(/\s+/g, ' ');
  }
  return text;
}

function normalizeToken(value) {
  return normalizeText(value, { stripNonAlnum: true });
}

module.exports = {
  normalizeText,
  normalizeToken
};
