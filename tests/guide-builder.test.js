import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { buildDraftJson, writeDraftJson, formatGuideUpdatePrompt } from '../lib/guide-builder.js';

const TEST_DIR = path.join(import.meta.dirname, '.test-guide-builder');

function setup() {
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

describe('buildDraftJson', () => {
  it('returns correct structure with all fields', () => {
    const words = ['Hello', 'world'];
    const result = buildDraftJson('email', words, 'Hello world');
    assert.deepEqual(result, {
      output_type: 'email',
      words,
      raw: 'Hello world',
    });
  });

  it('preserves output_type exactly', () => {
    const result = buildDraftJson('blog-post', [], '');
    assert.equal(result.output_type, 'blog-post');
  });

  it('preserves words array reference', () => {
    const words = ['a', 'b'];
    const result = buildDraftJson('memo', words, 'a b');
    assert.equal(result.words, words);
  });

  it('preserves raw string', () => {
    const raw = 'Some raw text with\nnewlines.';
    const result = buildDraftJson('report', [], raw);
    assert.equal(result.raw, raw);
  });

  it('handles empty words array', () => {
    const result = buildDraftJson('email', [], 'raw');
    assert.deepEqual(result.words, []);
  });
});

describe('writeDraftJson', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('writes current-draft.json to sessionDir', () => {
    const words = ['Hello'];
    writeDraftJson(TEST_DIR, 'email', words, 'Hello');
    const filePath = path.join(TEST_DIR, 'current-draft.json');
    assert.ok(fs.existsSync(filePath), 'current-draft.json should exist');
  });

  it('written file contains correct JSON structure', () => {
    const words = ['Test', 'text'];
    writeDraftJson(TEST_DIR, 'memo', words, 'Test text');
    const filePath = path.join(TEST_DIR, 'current-draft.json');
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    assert.deepEqual(parsed, {
      output_type: 'memo',
      words,
      raw: 'Test text',
    });
  });

  it('returns the draft object', () => {
    const words = ['x'];
    const result = writeDraftJson(TEST_DIR, 'letter', words, 'x');
    assert.deepEqual(result, {
      output_type: 'letter',
      words,
      raw: 'x',
    });
  });

  it('writes pretty-printed JSON (2-space indent)', () => {
    writeDraftJson(TEST_DIR, 'email', [], 'raw');
    const raw = fs.readFileSync(path.join(TEST_DIR, 'current-draft.json'), 'utf-8');
    // Pretty-printed JSON should have newlines
    assert.ok(raw.includes('\n'), 'JSON should be pretty-printed with newlines');
    // Should use 2-space indent
    assert.ok(raw.includes('  '), 'JSON should use 2-space indentation');
  });

  it('overwrites existing current-draft.json', () => {
    writeDraftJson(TEST_DIR, 'email', [], 'first');
    writeDraftJson(TEST_DIR, 'memo', ['second'], 'second');
    const parsed = JSON.parse(
      fs.readFileSync(path.join(TEST_DIR, 'current-draft.json'), 'utf-8')
    );
    assert.equal(parsed.output_type, 'memo');
    assert.equal(parsed.raw, 'second');
  });
});

describe('formatGuideUpdatePrompt', () => {
  const sampleGuide = '# Writing Style Guide\n\n## Tone\n- Be concise\n';

  it('includes the current guide in the output', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes(sampleGuide), 'prompt should include current guide');
  });

  it('formats a DISLIKE annotation correctly', () => {
    const annotations = [{ action: 'dislike', text: 'very unique', comment: 'overused phrase' }];
    const result = formatGuideUpdatePrompt(sampleGuide, annotations);
    assert.ok(result.includes('DISLIKE: "very unique" — overused phrase'));
  });

  it('formats a LIKE annotation correctly', () => {
    const annotations = [{ action: 'like', text: 'crystal clear', comment: null }];
    const result = formatGuideUpdatePrompt(sampleGuide, annotations);
    assert.ok(result.includes('LIKE: "crystal clear"'));
    assert.ok(!result.includes('LIKE: "crystal clear" — '), 'no comment dash when comment is absent');
  });

  it('formats a SUGGEST annotation with replacement', () => {
    const annotations = [
      { action: 'suggest', text: 'utilize', comment: 'simpler word', replacement: 'use' },
    ];
    const result = formatGuideUpdatePrompt(sampleGuide, annotations);
    assert.ok(result.includes('SUGGEST: "utilize" — simpler word -> "use"'));
  });

  it('handles annotation with replacement but no comment', () => {
    const annotations = [
      { action: 'suggest', text: 'commence', comment: null, replacement: 'start' },
    ];
    const result = formatGuideUpdatePrompt(sampleGuide, annotations);
    assert.ok(result.includes('SUGGEST: "commence" -> "start"'));
    assert.ok(!result.includes('SUGGEST: "commence" — '), 'no comment dash when comment is absent');
  });

  it('formats multiple annotations', () => {
    const annotations = [
      { action: 'dislike', text: 'very', comment: 'filler word' },
      { action: 'like', text: 'concise', comment: null },
      { action: 'suggest', text: 'big', comment: null, replacement: 'large' },
    ];
    const result = formatGuideUpdatePrompt(sampleGuide, annotations);
    assert.ok(result.includes('DISLIKE: "very" — filler word'));
    assert.ok(result.includes('LIKE: "concise"'));
    assert.ok(result.includes('SUGGEST: "big" -> "large"'));
  });

  it('upcases the action regardless of input casing', () => {
    const annotations = [{ action: 'dislike', text: 'foo', comment: null }];
    const result = formatGuideUpdatePrompt(sampleGuide, annotations);
    assert.ok(result.includes('DISLIKE:'));
    assert.ok(!result.includes('dislike:'));
  });

  it('returns a string containing INSTRUCTIONS section', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('## INSTRUCTIONS'));
  });

  it('returns a string containing CURRENT GUIDE section header', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('## CURRENT GUIDE'));
  });

  it('returns a string containing ANNOTATIONS FROM THIS ROUND section header', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('## ANNOTATIONS FROM THIS ROUND'));
  });

  it('handles empty annotations array', () => {
    assert.doesNotThrow(() => formatGuideUpdatePrompt(sampleGuide, []));
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(typeof result === 'string');
  });

  it('includes confidence tracking instructions', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('Confidence'), 'should mention confidence tracking');
  });

  it('includes example generation instructions', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('Examples'), 'should mention example generation');
  });

  it('includes boundary extraction instructions', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('Always Do') || result.includes('Boundaries'));
  });

  it('includes anti-voice instructions', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('Anti-Voice'));
  });

  it('includes YAML frontmatter update instructions', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('frontmatter'));
  });

  it('uses 4000 token budget', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(result.includes('4000'));
    assert.ok(!result.includes('~2000'));
  });

  it('includes output_type context when provided', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, [], 'tweet');
    assert.ok(result.includes('tweet'));
  });

  it('omits output_type section when not provided', () => {
    const result = formatGuideUpdatePrompt(sampleGuide, []);
    assert.ok(!result.includes('Output-Type Rules'));
  });
});
