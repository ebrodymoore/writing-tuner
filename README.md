# writing-tuner

A Claude Code skill for iteratively refining AI writing through word-level annotation feedback. Builds a versioned, portable writing style guide that captures your preferences.

## How It Works

1. **Seed** — Tell it what you're writing (tweet, blog post, etc.) and optionally upload writing samples
2. **Draft** — Claude generates writing or you paste in existing text
3. **Annotate** — Give feedback at the word/phrase level:
   - Like words you want to keep
   - Dislike words that feel wrong
   - Comment on why ("too formal", "cliche")
   - Suggest replacements
4. **Proof** — Claude generates a fresh sample using only your guide, so you can see if it learned
5. **Save** — Accept when satisfied. Your guide is versioned and portable.

## Install

Add this repo to your Claude Code skills:

```bash
claude config add skills /path/to/writing-tuner/skills
```

## Usage

```bash
# Start a new tuning session
/writing-tuner

# Resume with an existing guide
/writing-tuner --guide ./writing-guides/guide-latest.md
```

## Feedback Modes

### Terminal (keyboard-driven)

Best for short-form and quick passes.

```
[1] We're incredibly excited to announce
[2] our revolutionary new platform.
[3] Try it today.

> -1 "too hype"
> -2 "buzzword"
> +3 "good CTA, direct"
> done
```

### Browser (click-driven)

Best for longer pieces and detailed markup. Click or drag words to select, then annotate with the popup toolbar.

## The Writing Guide

Your guide is a portable markdown file:

```markdown
# Writing Guide v3

## Word Preferences
| Avoid      | Prefer | Reason        |
|------------|--------|---------------|
| utilize    | use    | too corporate |
| incredibly | (omit) | filler        |

## Voice & Tone
- Direct and confident
- No hedging or hype
```

Drop it into any Claude system prompt, CLAUDE.md, or API call.

## Requirements

- Node.js >= 18
- Claude Code

No npm dependencies.

## License

MIT
