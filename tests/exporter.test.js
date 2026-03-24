import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseYamlFrontmatter, exportSystemPrompt, exportClaudeMd } from '../lib/exporter.js';

const sampleGuide = `---
version: 3
generated: "2026-03-24"
sessions: 3
annotations: 47
output_type: "tweet"
parent_version: 2
---

# Writing Guide v3

## Voice & Tone
- Direct and punchy

## Anti-Voice
- Not academic
- Not sycophantic

## Boundaries

### Always Do
- Use active voice

### Never Do
- Never use "utilize"

## Word Preferences
| Avoid | Prefer | Reason | Confidence |
|-------|--------|--------|------------|
| utilize | use | too corporate | high |

## Sentence Patterns
- Short openers

## Structure Preferences
- Hook first

## Examples

<example type="good">
Delete old logs to free disk space.
</example>

<example type="bad">
I'd recommend considering the deletion of historical log files.
</example>

## Output-Type Rules: tweet
- One idea per tweet

## Learned from Samples
- Seeded from blog posts

## Session History
- v1: initial, v2: added word prefs, v3: added boundaries`;

const guideNoFrontmatter = `# Writing Guide v1

## Voice & Tone
- Be concise

## Session History
- v1: initial`;

describe('parseYamlFrontmatter', () => {
  it('parses all fields from frontmatter', () => {
    const result = parseYamlFrontmatter(sampleGuide);
    assert.equal(result.version, 3);
    assert.equal(result.generated, '2026-03-24');
    assert.equal(result.sessions, 3);
    assert.equal(result.annotations, 47);
    assert.equal(result.output_type, 'tweet');
    assert.equal(result.parent_version, 2);
  });

  it('returns empty object when no frontmatter', () => {
    const result = parseYamlFrontmatter(guideNoFrontmatter);
    assert.deepEqual(result, {});
  });

  it('parses null values', () => {
    const guide = '---\nparent_version: null\n---\n# Guide';
    const result = parseYamlFrontmatter(guide);
    assert.equal(result.parent_version, null);
  });

  it('parses numbers as numbers', () => {
    const guide = '---\nversion: 5\nsessions: 12\n---\n# Guide';
    const result = parseYamlFrontmatter(guide);
    assert.equal(typeof result.version, 'number');
    assert.equal(result.version, 5);
  });

  it('handles quoted and unquoted strings', () => {
    const guide = '---\ngenerated: "2026-03-24"\noutput_type: tweet\n---\n# Guide';
    const result = parseYamlFrontmatter(guide);
    assert.equal(result.generated, '2026-03-24');
    assert.equal(result.output_type, 'tweet');
  });
});

describe('exportSystemPrompt', () => {
  it('strips YAML frontmatter', () => {
    const result = exportSystemPrompt(sampleGuide);
    assert.ok(!result.includes('version: 3'));
    assert.ok(!result.includes('annotations: 47'));
  });

  it('strips Session History section', () => {
    const result = exportSystemPrompt(sampleGuide);
    assert.ok(!result.includes('## Session History'));
    assert.ok(!result.includes('v1: initial'));
  });

  it('wraps in writing-style tags', () => {
    const result = exportSystemPrompt(sampleGuide);
    assert.ok(result.startsWith('<writing-style>'));
    assert.ok(result.trimEnd().endsWith('</writing-style>'));
  });

  it('preserves content sections', () => {
    const result = exportSystemPrompt(sampleGuide);
    assert.ok(result.includes('## Voice & Tone'));
    assert.ok(result.includes('## Word Preferences'));
    assert.ok(result.includes('## Anti-Voice'));
    assert.ok(result.includes('## Boundaries'));
    assert.ok(result.includes('## Examples'));
  });

  it('works on guides without frontmatter', () => {
    const result = exportSystemPrompt(guideNoFrontmatter);
    assert.ok(result.includes('## Voice & Tone'));
    assert.ok(!result.includes('## Session History'));
  });

  it('strips Learned from Samples section', () => {
    const result = exportSystemPrompt(sampleGuide);
    assert.ok(!result.includes('## Learned from Samples'));
  });
});

describe('exportClaudeMd', () => {
  it('includes CLAUDE.md header', () => {
    const result = exportClaudeMd(sampleGuide);
    assert.ok(result.includes('# Writing Style Guide'));
  });

  it('includes instruction preamble', () => {
    const result = exportClaudeMd(sampleGuide);
    assert.ok(result.includes('follow these rules'));
  });

  it('strips frontmatter and session history', () => {
    const result = exportClaudeMd(sampleGuide);
    assert.ok(!result.includes('version: 3'));
    assert.ok(!result.includes('## Session History'));
  });
});
