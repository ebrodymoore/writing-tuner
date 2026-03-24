const CLAUSE_DELIMITERS = /,\s|;\s|\u2014\s?|--\s/;
const MAX_WORDS = 30;

function splitLongSentence(text) {
  const words = text.split(/\s+/).filter((w) => w.length > 0);
  if (words.length <= MAX_WORDS) return [text];

  const segments = [];
  let remaining = text;
  while (remaining.split(/\s+/).filter((w) => w.length > 0).length > MAX_WORDS) {
    const match = [...remaining.matchAll(new RegExp(CLAUSE_DELIMITERS, 'g'))];
    let bestIdx = -1;
    for (const m of match) {
      const wordsBeforeDelim = remaining.slice(0, m.index).split(/\s+/).filter((w) => w.length > 0).length;
      if (wordsBeforeDelim <= MAX_WORDS && wordsBeforeDelim > 0) {
        bestIdx = m.index + m[0].length;
      }
    }
    if (bestIdx === -1) {
      const words = remaining.split(/\s+/);
      const firstChunk = words.slice(0, MAX_WORDS).join(' ');
      segments.push(firstChunk);
      remaining = words.slice(MAX_WORDS).join(' ');
      continue;
    }
    segments.push(remaining.slice(0, bestIdx).trim());
    remaining = remaining.slice(bestIdx).trim();
  }
  if (remaining.length > 0) segments.push(remaining);
  return segments;
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

export function validateAnnotations(annotations, segments) {
  const valid = [];
  const warnings = [];
  for (const ann of annotations) {
    const seg = segments[ann.segment];
    if (!seg) {
      warnings.push(`Dropped: segment ${ann.segment} out of range (max ${segments.length - 1})`);
      continue;
    }
    const [start, end] = ann.words;
    if (start < 0 || end >= seg.words.length || start > end) {
      warnings.push(`Dropped: words [${start},${end}] out of range for segment ${ann.segment} (max word index ${seg.words.length - 1})`);
      continue;
    }
    const resolved = seg.words.slice(start, end + 1).join(' ');
    if (ann.text && ann.text !== resolved) {
      warnings.push(`Warning: annotation text "${ann.text}" inconsistent with resolved span "${resolved}" at segment ${ann.segment} words [${start},${end}]`);
    }
    valid.push(ann);
  }
  return { valid, warnings };
}

export function deduplicateAnnotations(annotations) {
  const map = new Map();
  for (const ann of annotations) {
    const key = `${ann.segment}:${ann.words[0]}-${ann.words[1]}`;
    map.set(key, ann);
  }
  return [...map.values()];
}

export function segmentText(raw) {
  const sentences = raw.match(/[^.!?]*[.!?]+(?:\s|$)/g) || [raw];
  const allSegments = [];
  let idx = 0;
  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (trimmed.length === 0) continue;
    const parts = splitLongSentence(trimmed);
    for (const part of parts) {
      allSegments.push({
        index: idx++,
        text: part,
        words: part.split(/\s+/).filter((w) => w.length > 0),
      });
    }
  }
  return allSegments;
}
