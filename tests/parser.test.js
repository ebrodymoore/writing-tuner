import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { segmentText } from '../lib/parser.js';

describe('segmentText', () => {
  it('splits text into sentences', () => {
    const result = segmentText('Hello world. This is a test. Done!');
    assert.equal(result.length, 3);
    assert.equal(result[0].text, 'Hello world.');
    assert.equal(result[1].text, 'This is a test.');
    assert.equal(result[2].text, 'Done!');
  });

  it('assigns 0-based segment indices', () => {
    const result = segmentText('First. Second.');
    assert.equal(result[0].index, 0);
    assert.equal(result[1].index, 1);
  });

  it('tokenizes words within each segment', () => {
    const result = segmentText('Hello world.');
    assert.deepEqual(result[0].words, ['Hello', 'world.']);
  });

  it('splits sentences over 30 words at clause boundaries', () => {
    const long = 'The quick brown fox jumped over the lazy dog and ran through the field and across the river, then it stopped by the old oak tree and rested for a while in the shade.';
    const result = segmentText(long);
    assert.ok(result.length > 1, `Expected >1 segment, got ${result.length}`);
    for (const seg of result) {
      assert.ok(seg.words.length <= 30, `Segment has ${seg.words.length} words: "${seg.text}"`);
    }
  });

  it('does not split sentences under 30 words', () => {
    const short = 'This is a short sentence with only ten words in it.';
    const result = segmentText(short);
    assert.equal(result.length, 1);
  });

  it('handles long sentences with no clause boundaries by force-splitting at word 30', () => {
    const words = Array.from({ length: 35 }, (_, i) => `word${i}`);
    const long = words.join(' ') + '.';
    const result = segmentText(long);
    assert.ok(result.length > 1, `Expected >1 segment, got ${result.length}`);
    assert.ok(result[0].words.length <= 30);
  });

  it('handles abbreviations as a known limitation (treats period as sentence end)', () => {
    const result = segmentText('Dr. Smith went home.');
    assert.ok(result.length >= 1);
  });
});
