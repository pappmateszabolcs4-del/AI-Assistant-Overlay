const TEMPLATE_SHAPE_PATTERNS = [
  { key: 'requires_x', pattern: /\brequires\b[^.]{1,60}\b/i },
  { key: 'blocked_without', pattern: /\bblocked without\b/i },
  { key: 'blocked_by_lack', pattern: /\bblocked by lack of\b/i },
  { key: 'consumes_resources', pattern: /\bconsumes\b[^.]{1,60}\b(resources?|materials?)\b/i },
  { key: 'requires_materials', pattern: /\brequires\b[^.]{1,60}\bmaterials?\b/i },
  { key: 'requires_components', pattern: /\brequires\b[^.]{1,60}\bcomponents?\b/i }
];

function getTemplateShape(text) {
  for (const entry of TEMPLATE_SHAPE_PATTERNS) {
    if (entry.pattern.test(text)) return entry.key;
  }
  return '';
}

module.exports = {
  getTemplateShape
};
