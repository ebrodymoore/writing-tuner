export function tokenizeText(raw) {
  return raw.split(/\s+/).filter((w) => w.length > 0);
}

export function parseAnnotations(jsonl) {
  return jsonl
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => {
      try { return JSON.parse(line); }
      catch { return null; }
    })
    .filter((a) => a !== null);
}

export function validateAnnotations(annotations, words) {
  const valid = [];
  const warnings = [];
  for (const ann of annotations) {
    if (ann.start < 0 || ann.end >= words.length || ann.start > ann.end) {
      warnings.push(`Dropped: word range [${ann.start},${ann.end}] out of range (max index ${words.length - 1})`);
      continue;
    }
    const resolved = words.slice(ann.start, ann.end + 1).join(' ');
    if (ann.text && ann.text !== resolved) {
      warnings.push(`Warning: annotation text "${ann.text}" inconsistent with resolved span "${resolved}" at words [${ann.start},${ann.end}]`);
    }
    valid.push(ann);
  }
  return { valid, warnings };
}

export function deduplicateAnnotations(annotations) {
  const map = new Map();
  for (const ann of annotations) {
    const key = `${ann.start}-${ann.end}`;
    map.set(key, ann);
  }
  return [...map.values()];
}
