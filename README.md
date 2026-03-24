# writing-tuner

**Teach Claude your writing style through feedback, not prompting.**

writing-tuner is a [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that lets you give word-level feedback on AI-generated writing. It extracts your preferences into a versioned, portable writing style guide that improves with every session.

The problem: getting Claude to write in your voice requires long, fragile system prompts — and you can't easily tell it "I like *this* word but hate *that* one." writing-tuner fixes this with an annotation-driven feedback loop.

---

## Quick Start

```bash
# 1. Clone the repo
git clone https://github.com/ebrodymoore/writing-tuner.git
cd writing-tuner

# 2. Run setup (writes paths so the skill can find its files)
npm run setup

# 3. Add the skill to Claude Code
claude config add skills "$(pwd)/skills"

# 4. Start tuning
/writing-tuner
```

**Requirements:** Node.js >= 18, Claude Code. No npm dependencies.

---

## How It Works

```
  SEED ──> DRAFT ──> ANNOTATE ──> EXTRACT ──> PROOF ──> SAVE
   │                    │             │          │
   │  declare output    │  thumbs     │  guide   │  fresh sample
   │  type + samples    │  up/down    │  updates │  from guide only
   │                    │  comments   │          │
   │                    │  suggests   │          ▼
   │                    │             │     accept / annotate more /
   │                    ▼             │     compare variants /
   │               terminal OR       │     test new prompt
   │               browser           │
   └──────────────────────────────────┘
              (repeat until satisfied)
```

1. **Seed** — Declare what you're writing (tweet, blog post, long-form, marketing copy, or general style). Upload existing writing samples to establish your baseline voice.

2. **Draft** — Claude generates writing using your current guide, or you paste in existing text.

3. **Annotate** — Give precise feedback at the word and phrase level. Two modes:
   - **Terminal:** keyboard shortcuts for fast annotation
   - **Browser:** click/drag to select words in a local web UI

4. **Extract** — The tool analyzes your feedback and updates the writing guide automatically.

5. **Proof** — Claude generates a fresh sample using *only* the guide (no session context). This is how you know the guide actually captures your style vs. just fixing one document.

6. **Save** — Accept when satisfied. Your guide is versioned (`guide-v1.md`, `guide-v2.md`, ...) and portable.

---

## Feedback Modes

### Terminal Mode

Best for short-form writing and quick passes. Keyboard-driven.

```
[1] We're incredibly excited to announce
[2] our revolutionary new platform.
[3] Try it today.

> -1 "too hype"
> -2 "buzzword"
> +3 "good CTA, direct"
> s1 "We just launched"
> done
```

**Commands:**

| Command | Action |
|---------|--------|
| `+N` | Like entire segment N |
| `-N` | Dislike entire segment N |
| `+N:W-W` | Like specific words in segment N |
| `-N "reason"` | Dislike with a comment |
| `sN "text"` | Suggest replacement for segment N |
| `m` | Switch to browser mode |
| `done` | Finish annotating |

### Browser Mode

Best for longer pieces and detailed markup. A local web UI with click/drag word selection.

- Click or drag to select any word or phrase
- Floating toolbar appears with Like / Dislike / Suggest buttons
- Add optional comments or replacement text
- Color-coded highlights show your annotations (green = liked, red = disliked, yellow = suggested)

Switch between modes at any time during a session.

---

## The Writing Guide

Your guide is a human-readable markdown file that doubles as machine-readable instructions:

```markdown
# Writing Guide v3
Generated: 2026-03-23 | Sessions: 3 | Annotations: 47

## Voice & Tone
- Conversational but not sloppy
- Confident without being arrogant
- Prefer direct statements over hedging

## Word Preferences
| Avoid          | Prefer   | Reason              |
|----------------|----------|---------------------|
| utilize        | use      | too corporate       |
| incredibly     | (omit)   | hyperbolic filler   |
| in order to    | to       | unnecessary padding |

## Sentence Patterns
- Likes: Short punchy openers
- Likes: Em dashes for asides
- Dislikes: Rhetorical questions as transitions

## Structure Preferences
- Blog posts: Start with a hook, not a preamble
- Tweets: One idea per tweet, no thread bait
```

**Key properties:**
- **Human-editable** — open it and tweak rules by hand anytime
- **Versioned** — each save creates `guide-v1.md`, `guide-v2.md`, etc.
- **Portable** — drop it into any Claude system prompt, CLAUDE.md, or API call
- **Cumulative** — preferences compound across sessions

---

## Usage

### New Session

```bash
/writing-tuner
```

You'll be asked:
1. What writing output you're tuning for (tweet, blog, etc.)
2. Whether to upload writing samples
3. Preferred feedback mode (terminal or browser)

### Resume a Previous Session

```bash
/writing-tuner --guide ./writing-guides/guide-latest.md
```

Picks up where you left off with your existing style guide.

### After Annotating

After each annotation round, Claude generates a **proof sample** — fresh writing using only the guide. You choose what to do next:

- **Accept** — save the guide and exit
- **Annotate** — mark up the proof sample for another round
- **Compare variants** — see 2-3 different versions side by side
- **Test another prompt** — try a completely different writing task
- **Annotate another doc** — feed in new writing for more signal

---

## Architecture

```
writing-tuner/
├── skills/writing-tuner/     # Claude Code skill (the orchestration layer)
│   ├── skill.md              # Main workflow prompt
│   ├── annotate-terminal.md  # Terminal feedback mode
│   └── annotate-browser.md   # Browser feedback mode
├── server/                   # Browser annotation UI
│   ├── server.js             # Zero-dep HTTP server (node:http)
│   ├── index.html            # Annotation SPA
│   └── styles.css
├── lib/                      # JS utilities (file I/O only, no API calls)
│   ├── parser.js             # Text segmentation + annotation parsing
│   ├── guide-builder.js      # Draft JSON + guide update prompts
│   └── versioner.js          # Guide versioning + lock management
├── templates/
│   └── guide-template.md     # Starting template for new guides
└── tests/                    # 70 tests across 13 suites
```

**Design principle:** All reasoning (analyzing feedback, extracting preferences, generating writing) is done by Claude through the skill prompt. The JS code handles only mechanical concerns: parsing files, serving HTML, and managing versions. This means the tool automatically improves as Claude gets better.

---

## Development

```bash
# Run tests
npm test

# Run specific test suite
node --test tests/parser.test.js
```

70 tests, zero dependencies, ~100ms runtime.

---

## Contributing

Issues and PRs welcome. The main areas for contribution:

- **Annotation UX** — improvements to the terminal command syntax or browser UI
- **Guide format** — better structures for capturing writing preferences
- **New output types** — specialized handling for different writing forms

## License

MIT
