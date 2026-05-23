const http = require('http');
const https = require('https');

function sanitizeText(text) {
  return String(text || '')
    .replace(/[\u2028\u2029\u0085]/g, '\n')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function fetchUrlText(url, options = {}) {
  const target = String(url || '').trim();
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 2 * 1024 * 1024;
  const userAgent = String(options.userAgent || 'AI-Game-Assistant-Fact-Extractor/1.0').trim();
  const client = target.startsWith('https://') ? https : http;

  return new Promise((resolve, reject) => {
    const request = client.get(target, {
      headers: {
        'User-Agent': userAgent
      }
    }, (res) => {
      if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode}`));
      }
      const chunks = [];
      let received = 0;
      res.on('data', (chunk) => {
        received += chunk.length;
        if (maxBytes && received > maxBytes) {
          res.destroy();
          return reject(new Error('source-too-large'));
        }
        chunks.push(chunk);
      });
      res.on('end', () => {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(sanitizeText(raw));
      });
    });

    request.on('error', reject);
  });
}

module.exports = {
  fetchUrlText
};
