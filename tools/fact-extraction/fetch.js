const http = require('http');
const https = require('https');

function sanitizeText(text) {
  return String(text || '')
    .replace(/[\u2028\u2029\u0085]/g, '\n')
    .replace(/[\u200B-\u200F\u202A-\u202E\u2060-\u206F\uFEFF]/g, '')
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
}

function estimateTokens(text) {
  const raw = String(text || '');
  if (!raw) return 0;
  return Math.max(1, Math.ceil(raw.length / 4));
}

function extractArticleBody(html) {
  const raw = String(html || '');
  if (!raw) return '';
  const lower = raw.toLowerCase();
  if (!lower.includes('<html') && !lower.includes('<body')) return raw;

  let body = raw;
  const candidates = [
    /<main[^>]*>([\s\S]*?)<\/main>/i,
    /<article[^>]*>([\s\S]*?)<\/article>/i,
    /<div[^>]*id=["']content["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*id=["']mw-content-text["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*mw-parser-output[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*content[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*article[^"']*["'][^>]*>([\s\S]*?)<\/div>/i,
    /<div[^>]*class=["'][^"']*main[^"']*["'][^>]*>([\s\S]*?)<\/div>/i
  ];
  let bestMatch = '';
  for (const pattern of candidates) {
    const flags = pattern.flags.includes('g') ? pattern.flags : `${pattern.flags}g`;
    const globalPattern = new RegExp(pattern.source, flags);
    const matches = raw.matchAll(globalPattern);
    for (const match of matches) {
      const content = match && match[1] ? match[1] : '';
      if (content && content.length > bestMatch.length) {
        bestMatch = content;
      }
    }
  }
  if (bestMatch) body = bestMatch;

  body = body
    .replace(/<nav[\s\S]*?<\/nav>/gi, ' ')
    .replace(/<header[\s\S]*?<\/header>/gi, ' ')
    .replace(/<footer[\s\S]*?<\/footer>/gi, ' ')
    .replace(/<aside[\s\S]*?<\/aside>/gi, ' ')
    .replace(/<div[^>]*class=["'][^"']*(infobox|toc|sidebar|navbox|metadata|mw-navigation|site-notice|catlinks|footer|header|nav|menu|toolbar)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi, ' ')
    .replace(/<table[^>]*class=["'][^"']*(infobox|navbox|metadata|toc|sidebar|ambox|mbox|hatnote|portalbox|messagebox|vertical-navbox|sistersitebox|navframe|nowraplinks|plainlinks|collapsible|mw-collapsible)[^"']*["'][^>]*>[\s\S]*?<\/table>/gi, ' ')
    .replace(/<table[^>]*role=["']presentation["'][^>]*>[\s\S]*?<\/table>/gi, ' ')
    .replace(/<div[^>]*id=["']toc["'][^>]*>[\s\S]*?<\/div>/gi, ' ')
    .replace(/<span[^>]*class=["'][^"']*mw-editsection[^"']*["'][^>]*>[\s\S]*?<\/span>/gi, ' ');

  const extractedTokens = estimateTokens(body);
  const rawTokens = estimateTokens(raw);
  if (rawTokens > 2000 && extractedTokens < Math.max(200, rawTokens * 0.1)) {
    const bodyMatch = raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch && bodyMatch[1] && estimateTokens(bodyMatch[1]) > extractedTokens) {
      return bodyMatch[1];
    }
    return raw;
  }

  return body;
}

function fetchUrlText(url, options = {}) {
  const target = String(url || '').trim();
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 2 * 1024 * 1024;
  const userAgent = String(options.userAgent || 'AI-Game-Assistant-Fact-Extractor/1.0').trim();
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : 5;

  return new Promise((resolve, reject) => {
    const requestOnce = (currentUrl, redirectsLeft) => {
      const client = currentUrl.startsWith('https://') ? https : http;
      const request = client.get(currentUrl, {
        headers: {
          'User-Agent': userAgent
        }
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            res.resume();
            return reject(new Error('too-many-redirects'));
          }
          const nextUrl = new URL(res.headers.location, currentUrl).toString();
          res.resume();
          return requestOnce(nextUrl, redirectsLeft - 1);
        }
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
          const extracted = extractArticleBody(raw);
          resolve(sanitizeText(extracted));
        });
      });

      request.on('error', reject);
    };

    requestOnce(target, maxRedirects);
  });
}

function fetchUrlHtml(url, options = {}) {
  const target = String(url || '').trim();
  const maxBytes = Number.isFinite(options.maxBytes) ? options.maxBytes : 2 * 1024 * 1024;
  const userAgent = String(options.userAgent || 'AI-Game-Assistant-Fact-Extractor/1.0').trim();
  const maxRedirects = Number.isFinite(options.maxRedirects) ? options.maxRedirects : 5;

  return new Promise((resolve, reject) => {
    const requestOnce = (currentUrl, redirectsLeft) => {
      const client = currentUrl.startsWith('https://') ? https : http;
      const request = client.get(currentUrl, {
        headers: {
          'User-Agent': userAgent
        }
      }, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          if (redirectsLeft <= 0) {
            res.resume();
            return reject(new Error('too-many-redirects'));
          }
          const nextUrl = new URL(res.headers.location, currentUrl).toString();
          res.resume();
          return requestOnce(nextUrl, redirectsLeft - 1);
        }
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
    };

    requestOnce(target, maxRedirects);
  });
}

module.exports = {
  fetchUrlText,
  fetchUrlHtml,
  extractArticleBody
};
