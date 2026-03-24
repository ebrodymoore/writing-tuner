const CLAUSE_DELIMITERS = /,\s|;\s|\u2014\s|--\s/;
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
