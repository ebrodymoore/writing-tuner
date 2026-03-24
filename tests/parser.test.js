import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { tokenizeText, parseAnnotations, validateAnnotations, deduplicateAnnotations } from '../lib/parser.js';

describe('tokenizeText', () => {
  it('splits text into words by whitespace', () => {
    const result = tokenizeText('Hello world. This is a test. Done!');
    assert.deepEqual(result, ['Hello', 'world.', 'This', 'is', 'a', 'test.', 'Done!']);
  });

  it('handles multiple spaces and tabs', () => {
    const result = tokenizeText('Hello   world\ttest');
    assert.deepEqual(result, ['Hello', 'world', 'test']);
  });

  it('returns empty array for empty string', () => {
    const result = tokenizeText('');
    assert.deepEqual(result, []);
  });

  it('returns empty array for whitespace-only string', () => {
    const result = tokenizeText('   \t\n  ');
    assert.deepEqual(result, []);
  });

  it('handles single word', () => {
    const result = tokenizeText('Hello');
    assert.deepEqual(result, ['Hello']);
  });

  it('handles text with newlines', () => {
    const result = tokenizeText('Hello\nworld\n\ntest');
    assert.deepEqual(result, ['Hello', 'world', 'test']);
  });
});

describe('parseAnnotations', () => {
  it('parses a JSONL string into annotation objects', () => {
    const jsonl = '{"start":0,"end":1,"text":"Hello world"}\n{"start":2,"end":4,"text":"This is test"}';
    const result = parseAnnotations(jsonl);
    assert.equal(result.length, 2);
    assert.equal(result[0].start, 0);
    assert.equal(result[0].end, 1);
    assert.equal(result[0].text, 'Hello world');
    assert.equal(result[1].start, 2);
  });

  it('skips blank lines and invalid JSON', () => {
    const jsonl = '{"start":0,"end":1,"text":"Hello world"}\n\n   \nnot-valid-json\n{"start":2,"end":2,"text":"Done"}';
    const result = parseAnnotations(jsonl);
    assert.equal(result.length, 2);
    assert.equal(result[0].start, 0);
    assert.equal(result[1].start, 2);
  });
});

describe('validateAnnotations', () => {
  const words = ['Hello', 'world.', 'This', 'is', 'a', 'test.'];

  it('passes valid annotations through', () => {
    const annotations = [{ start: 0, end: 1, text: 'Hello world.' }];
    const { valid, warnings } = validateAnnotations(annotations, words);
    assert.equal(valid.length, 1);
    assert.equal(warnings.length, 0);
    assert.equal(valid[0].start, 0);
  });

  it('rejects annotations with out-of-range indices', () => {
    const annotations = [{ start: 0, end: 10, text: 'missing' }];
    const { valid, warnings } = validateAnnotations(annotations, words);
    assert.equal(valid.length, 0);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('out of range'));
  });

  it('rejects annotations with negative start', () => {
    const annotations = [{ start: -1, end: 1, text: 'bad' }];
    const { valid, warnings } = validateAnnotations(annotations, words);
    assert.equal(valid.length, 0);
    assert.equal(warnings.length, 1);
  });

  it('rejects annotations where start > end', () => {
    const annotations = [{ start: 3, end: 1, text: 'bad' }];
    const { valid, warnings } = validateAnnotations(annotations, words);
    assert.equal(valid.length, 0);
    assert.equal(warnings.length, 1);
  });

  it('warns but keeps annotations where text does not match resolved span', () => {
    const annotations = [{ start: 0, end: 1, text: 'wrong text' }];
    const { valid, warnings } = validateAnnotations(annotations, words);
    assert.equal(valid.length, 1);
    assert.equal(warnings.length, 1);
    assert.ok(warnings[0].includes('inconsistent'));
  });

  it('passes annotation with matching text', () => {
    const annotations = [{ start: 2, end: 5, text: 'This is a test.' }];
    const { valid, warnings } = validateAnnotations(annotations, words);
    assert.equal(valid.length, 1);
    assert.equal(warnings.length, 0);
  });
});

describe('deduplicateAnnotations', () => {
  it('last-wins on same span key', () => {
    const annotations = [
      { start: 0, end: 1, text: 'first' },
      { start: 0, end: 1, text: 'second' },
    ];
    const result = deduplicateAnnotations(annotations);
    assert.equal(result.length, 1);
    assert.equal(result[0].text, 'second');
  });

  it('preserves annotations with different spans', () => {
    const annotations = [
      { start: 0, end: 1, text: 'span one' },
      { start: 2, end: 3, text: 'span two' },
      { start: 4, end: 5, text: 'span three' },
    ];
    const result = deduplicateAnnotations(annotations);
    assert.equal(result.length, 3);
  });
});
