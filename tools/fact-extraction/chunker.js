function estimateTokens(text) {
  const raw = String(text || '');
  if (!raw) return 0;
  return Math.max(1, Math.ceil(raw.length / 4));
}

function isHeadingLine(line) {
  const trimmed = String(line || '').trim();
  return isStrongHeadingLine(trimmed) || headingConfidence(trimmed) >= 0.55;
}

function isStrongHeadingLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return false;
  if (/^#{1,6}\s+\S/.test(trimmed)) return true;
  if (/^\d+(?:\.\d+)*[.)]?\s+\S/.test(trimmed)) return true;
  return false;
}

function headingConfidence(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed) return 0;

  let score = 0;
  const words = trimmed.split(/\s+/).filter(Boolean);
  const letters = trimmed.replace(/[^A-Za-z]/g, '');
  const upper = letters.replace(/[^A-Z]/g, '').length;

  if (/^#{1,6}\s+\S/.test(trimmed)) score += 0.6;
  if (/^\d+(?:\.\d+)*[.)]?\s+\S/.test(trimmed)) score += 0.35;
  if (/:$/.test(trimmed)) score += 0.25;

  if (words.length > 0 && words.length <= 10) {
    const titleCase = words.filter((word) => /^[A-Z][a-z]+$/.test(word)).length;
    if (titleCase >= Math.ceil(words.length * 0.6)) score += 0.2;
  }
  if (letters.length >= 6 && upper / letters.length >= 0.7) score += 0.2;

  if (words.length <= 2) score -= 0.15;
  if (words.length <= 4 && trimmed.length <= 20) score -= 0.1;
  if ((trimmed.match(/[|/\\]/g) || []).length >= 2) score -= 0.2;
  if ((trimmed.match(/[:;.,\-]/g) || []).length >= 4) score -= 0.15;
  if (/\b(home|search|navigation|edit|view|history|help|portal|category|namespace|page)\b/i.test(trimmed)) {
    score -= 0.25;
  }
  if (/^[-*•]+\s+/.test(trimmed)) score -= 0.2;
  if (/[.!?]$/.test(trimmed)) score -= 0.2;

  return Math.max(0, Math.min(1, score));
}

function decodeHtmlEntities(text) {
  return String(text || '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
}

function normalizeMarkupText(text) {
  const raw = String(text || '');
  if (!raw) return '';
  if (!/[<>]/.test(raw)) return raw;
  if (!/<\/?(html|body|div|p|br|li|ul|ol|h[1-6]|section|article|table|tr|td|th)\b/i.test(raw)) {
    return raw;
  }
  let cleaned = raw;
  const stripInlineTags = (value) => String(value || '').replace(/<[^>]+>/g, ' ');
  cleaned = cleaned.replace(/<h([1-6])[^>]*>([\s\S]*?)<\/h\1>/gi, (_match, level, content) => {
    const textValue = stripInlineTags(content).replace(/\s+/g, ' ').trim();
    if (!textValue) return '\n';
    const marks = '#'.repeat(Math.min(6, Number(level) || 1));
    return `\n${marks} ${textValue}\n`;
  });
  cleaned = cleaned.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  cleaned = cleaned.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  cleaned = cleaned.replace(/<br\s*\/?\s*>/gi, '\n');
  cleaned = cleaned.replace(/<li[^>]*>/gi, '\n- ');
  cleaned = cleaned.replace(/<\/li>/gi, '\n');
  cleaned = cleaned.replace(/<(p|div|section|article|tr|table|ul|ol)[^>]*>/gi, '\n');
  cleaned = cleaned.replace(/<\/(p|div|section|article|tr|table|ul|ol)>/gi, '\n');
  cleaned = cleaned.replace(/<[^>]+>/g, ' ');
  cleaned = decodeHtmlEntities(cleaned);
  cleaned = cleaned.replace(/\[\s*edit\s*\]/gi, ' ');
  cleaned = cleaned.replace(/\[\s*hide\s*\]/gi, ' ');
  cleaned = cleaned.replace(/\[\s*show\s*\]/gi, ' ');
  cleaned = cleaned.replace(/[ \t]+/g, ' ');
  cleaned = cleaned.replace(/\n\s*\n\s*\n+/g, '\n\n');
  return cleaned.trim();
}

function mergeAdjacentTinySections(sections) {
  const output = [];
  const list = Array.isArray(sections) ? sections : [];
  for (const section of list) {
    if (!section || !section.text) continue;
    const short = Number(section.tokenEstimate || 0) > 0 && Number(section.tokenEstimate || 0) < 120;
    if (output.length && short) {
      const prev = output[output.length - 1];
      if (prev && !prev.heading && !section.heading) {
        prev.text = `${prev.text}\n\n${section.text}`.trim();
        prev.tokenEstimate = estimateTokens(prev.text);
        continue;
      }
    }
    output.push({ ...section });
  }
  return output;
}

function parseHeadingLine(line) {
  const trimmed = String(line || '').trim();
  if (!trimmed || /^[-*•]+\s+/.test(trimmed)) return null;
  const hashMatch = trimmed.match(/^(#{1,6})\s+(.*)$/);
  if (hashMatch) {
    return { level: hashMatch[1].length, title: hashMatch[2].trim() };
  }
  if (/^\d+(?:\.\d+)*[.)]?\s+\S/.test(trimmed)) {
    return { level: 2, title: trimmed.replace(/^\d+(?:\.\d+)*[.)]?\s+/, '').trim() };
  }
  return null;
}

function mergeSectionBudget(sections, maxSections) {
  const list = Array.isArray(sections) ? sections.slice() : [];
  if (!maxSections || list.length <= maxSections) return list;

  const mergePair = (index) => {
    const first = list[index];
    const second = list[index + 1];
    if (!first || !second) return;
    const mergedText = `${first.text}\n\n${second.text}`.trim();
    list.splice(index, 2, {
      ...first,
      text: mergedText,
      tokenEstimate: estimateTokens(mergedText)
    });
  };

  while (list.length > maxSections) {
    let bestIndex = -1;
    let bestTokens = Number.POSITIVE_INFINITY;
    for (let i = 0; i < list.length - 1; i += 1) {
      const a = list[i];
      const b = list[i + 1];
      if (!a || !b) continue;
      const sameParent = a.parentSectionId && a.parentSectionId === b.parentSectionId;
      if (!sameParent) continue;
      const combined = (a.tokenEstimate || 0) + (b.tokenEstimate || 0);
      if (combined < bestTokens) {
        bestTokens = combined;
        bestIndex = i;
      }
    }
    if (bestIndex === -1) {
      for (let i = 0; i < list.length - 1; i += 1) {
        const combined = (list[i].tokenEstimate || 0) + (list[i + 1].tokenEstimate || 0);
        if (combined < bestTokens) {
          bestTokens = combined;
          bestIndex = i;
        }
      }
    }
    if (bestIndex === -1) break;
    mergePair(bestIndex);
  }

  return list;
}

function mergeAdjacentHierSections(sections) {
  const output = [];
  const list = Array.isArray(sections) ? sections : [];
  for (const section of list) {
    if (!section || !section.text) continue;
    const short = Number(section.tokenEstimate || 0) > 0 && Number(section.tokenEstimate || 0) < 120;
    if (output.length && short) {
      const prev = output[output.length - 1];
      const samePath = prev && section && String(prev.sectionPath || '') === String(section.sectionPath || '');
      if (samePath) {
        prev.text = `${prev.text}\n\n${section.text}`.trim();
        prev.tokenEstimate = estimateTokens(prev.text);
        continue;
      }
    }
    output.push({ ...section });
  }
  return output;
}

function extractHierarchicalSections(text) {
  const normalized = normalizeMarkupText(text);
  const lines = String(normalized || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const sections = [];
  const stack = [];
  let current = { heading: '', path: [], lines: [], sectionId: '', parentSectionId: '', depth: 0 };
  let sectionCounter = 0;

  const flush = () => {
    const body = current.lines.join('\n').trim();
    if (!body && !current.heading) return;
    const heading = current.heading || '';
    const path = Array.isArray(current.path) ? current.path : [];
    const payload = [heading, body].filter(Boolean).join('\n').trim();
    if (!payload) return;
    sections.push({
      heading,
      headingPath: path,
      sectionPath: path.join(' > '),
      sectionId: current.sectionId,
      parentSectionId: current.parentSectionId,
      depth: current.depth,
      text: payload,
      tokenEstimate: estimateTokens(payload)
    });
  };

  for (const line of lines) {
    const headingInfo = parseHeadingLine(line);
    if (headingInfo && isStrongHeadingLine(line)) {
      flush();
      while (stack.length && stack[stack.length - 1].level >= headingInfo.level) {
        stack.pop();
      }
      const parentId = stack.length ? stack[stack.length - 1].sectionId : '';
      sectionCounter += 1;
      const sectionId = `sec-${sectionCounter}`;
      stack.push({ level: headingInfo.level, title: headingInfo.title, sectionId });
      current = {
        heading: headingInfo.title,
        path: stack.map((entry) => entry.title),
        lines: [],
        sectionId,
        parentSectionId: parentId,
        depth: stack.length
      };
      continue;
    }
    current.lines.push(line);
  }
  flush();

  return mergeAdjacentHierSections(sections);
}

function buildSections(text) {
  const normalized = normalizeMarkupText(text);
  const lines = String(normalized || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const sections = [];
  let current = { heading: '', lines: [] };
  let headingCount = 0;

  const pushCurrent = () => {
    const body = current.lines.join('\n').trim();
    const heading = String(current.heading || '').trim();
    if (!heading && !body) return;
    const payload = [heading, body].filter(Boolean).join('\n');
    sections.push({
      heading,
      text: payload,
      tokenEstimate: estimateTokens(payload)
    });
  };

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const trimmed = String(line || '').trim();
    const confidence = headingConfidence(trimmed);
    const strong = isStrongHeadingLine(trimmed);
    const prevBlank = i === 0 ? true : !String(lines[i - 1] || '').trim();
    const nextBlank = i === lines.length - 1 ? true : !String(lines[i + 1] || '').trim();

    if (trimmed && (strong || (confidence >= 0.55 && (prevBlank || nextBlank)))) {
      headingCount += 1;
      pushCurrent();
      current = { heading: trimmed, lines: [] };
    } else {
      current.lines.push(line);
    }
  }
  pushCurrent();

  if (headingCount === 0) {
    const paragraphs = [];
    let buffer = [];
    for (const line of lines) {
      if (!line.trim()) {
        if (buffer.length) {
          paragraphs.push(buffer.join('\n'));
          buffer = [];
        }
        continue;
      }
      buffer.push(line);
    }
    if (buffer.length) paragraphs.push(buffer.join('\n'));
    const sectionList = paragraphs.map((paragraph) => {
      const payload = String(paragraph || '').trim();
      return { heading: '', text: payload, tokenEstimate: estimateTokens(payload) };
    }).filter((entry) => entry.text);
    return mergeAdjacentTinySections(sectionList);
  }

  return mergeAdjacentTinySections(sections);
}

function analyzeTextStructure(text) {
  const raw = String(text || '');
  const normalized = normalizeMarkupText(text);
  const lines = String(normalized || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const nonEmptyLines = lines.filter((line) => String(line || '').trim()).length;
  let headingLines = 0;
  let listLines = 0;
  for (const line of lines) {
    const trimmed = String(line || '').trim();
    if (!trimmed) continue;
    if (isHeadingLine(trimmed)) headingLines += 1;
    if (/^[-*•]+\s+/.test(trimmed)) listLines += 1;
  }

  const sections = buildSections(text);
  const sectionTokens = sections.map((section) => Number(section.tokenEstimate || 0));
  const totalSectionTokens = sectionTokens.reduce((sum, value) => sum + value, 0);
  const shortSections = sectionTokens.filter((value) => value > 0 && value < 200).length;

  return {
    rawChars: raw.length,
    normalizedChars: normalized.length,
    rawTokens: estimateTokens(raw),
    normalizedTokens: estimateTokens(normalized),
    lines: lines.length,
    nonEmptyLines,
    headingLines,
    listLines,
    sections: sections.length,
    avgSectionTokens: sections.length ? Number((totalSectionTokens / sections.length).toFixed(2)) : 0,
    shortSectionShare: sections.length ? Number((shortSections / sections.length).toFixed(3)) : 0
  };
}

function splitLargeText(text, maxTokens) {
  const raw = String(text || '').trim();
  if (!raw) return [];
  if (estimateTokens(raw) <= maxTokens) return [raw];

  const sentences = raw.split(/(?<=[.!?])\s+(?=[A-Z0-9])/).filter(Boolean);
  if (sentences.length <= 1) {
    const words = raw.split(/\s+/).filter(Boolean);
    const pieces = [];
    let buffer = [];
    for (const word of words) {
      const next = buffer.concat(word).join(' ');
      if (buffer.length && estimateTokens(next) > maxTokens) {
        pieces.push(buffer.join(' '));
        buffer = [word];
      } else {
        buffer.push(word);
      }
    }
    if (buffer.length) pieces.push(buffer.join(' '));
    return pieces;
  }

  const chunks = [];
  let buffer = [];
  for (const sentence of sentences) {
    const next = buffer.concat(sentence).join(' ');
    if (buffer.length && estimateTokens(next) > maxTokens) {
      chunks.push(buffer.join(' '));
      buffer = [sentence];
    } else {
      buffer.push(sentence);
    }
  }
  if (buffer.length) chunks.push(buffer.join(' '));
  return chunks;
}

function chunkText(text, options = {}) {
  const minTokens = Number.isFinite(options.minTokens) ? options.minTokens : 500;
  const maxTokens = Number.isFinite(options.maxTokens) ? options.maxTokens : 1500;
  const maxChunks = Number.isFinite(options.maxChunks) ? Math.max(1, options.maxChunks) : 0;
  const sections = buildSections(text);
  const chunks = [];
  let chunkId = 1;

  if (!sections.length) return chunks;

  const totalTokens = sections.reduce((sum, section) => sum + (section.tokenEstimate || 0), 0);
  const targetTokens = maxChunks
    ? Math.min(maxTokens - 50, Math.max(minTokens, Math.ceil(totalTokens / maxChunks)))
    : minTokens;

  const flush = (buffer) => {
    if (!buffer.length) return;
    const payload = buffer.join('\n\n').trim();
    if (!payload) return;
    chunks.push({
      chunkId,
      text: payload,
      tokenEstimate: estimateTokens(payload)
    });
    chunkId += 1;
  };

  let buffer = [];
  let bufferTokens = 0;
  for (const section of sections) {
    if (section.tokenEstimate > maxTokens) {
      if (buffer.length) {
        flush(buffer);
        buffer = [];
        bufferTokens = 0;
      }
      const pieces = splitLargeText(section.text, maxTokens);
      for (const piece of pieces) {
        chunks.push({
          chunkId,
          text: piece,
          tokenEstimate: estimateTokens(piece)
        });
        chunkId += 1;
      }
      continue;
    }

    const nextTokens = bufferTokens + section.tokenEstimate;
    if (buffer.length && nextTokens > maxTokens) {
      flush(buffer);
      buffer = [section.text];
      bufferTokens = section.tokenEstimate;
      continue;
    }

    buffer.push(section.text);
    bufferTokens = nextTokens;
    if (bufferTokens >= targetTokens) {
      flush(buffer);
      buffer = [];
      bufferTokens = 0;
    }
  }

  if (buffer.length) flush(buffer);

  if (maxChunks && chunks.length > maxChunks) {
    while (chunks.length > maxChunks) {
      let bestIndex = -1;
      let bestTokens = Number.POSITIVE_INFINITY;
      for (let i = 0; i < chunks.length - 1; i += 1) {
        const combined = chunks[i].tokenEstimate + chunks[i + 1].tokenEstimate;
        if (combined <= maxTokens && combined < bestTokens) {
          bestTokens = combined;
          bestIndex = i;
        }
      }
      if (bestIndex === -1) break;
      const mergedText = `${chunks[bestIndex].text}\n\n${chunks[bestIndex + 1].text}`.trim();
      const mergedChunk = {
        chunkId: chunks[bestIndex].chunkId,
        text: mergedText,
        tokenEstimate: estimateTokens(mergedText)
      };
      chunks.splice(bestIndex, 2, mergedChunk);
    }
  }

  return chunks.map((chunk, index) => ({
    chunkId: index + 1,
    text: chunk.text,
    tokenEstimate: chunk.tokenEstimate
  }));
}

module.exports = {
  chunkText,
  estimateTokens,
  isHeadingLine,
  analyzeTextStructure,
  extractHierarchicalSections,
  normalizeMarkupText,
  mergeSectionBudget
};
