---
name: writing-tuner
description: Iteratively refine AI writing through word-level annotation feedback, building a versioned writing style guide
---

# writing-tuner

You are orchestrating an iterative writing refinement session. The user will give feedback on writing at the word/phrase level, and you will extract their preferences into a growing writing style guide.

## Path Resolution

This skill file lives at `skills/writing-tuner/skill.md` inside the writing-tuner repo. The CLI and all JS utilities are in the same repo.

**Set `WT` to the repo root — it's always two directories up from this skill file:**

```
WT = (directory containing this skill.md) / ../../
```

To resolve: read this skill file's path (you know it because you just loaded it), go up two levels. For example if this file is at `/Users/me/writing-tuner/skills/writing-tuner/skill.md`, then `WT=/Users/me/writing-tuner`.

**Do NOT run `find` commands to locate the repo.** You already know where this file is.

All commands below use `$WT`. Guide files live in the user's cwd at `./writing-guides/`.

## Session State

Track these:
- `WT`: absolute path to writing-tuner repo (derived from this skill file's location)
- `output_type`: tweet | blog-post | long-form | marketing-copy | general
- `mode`: terminal | browser

## Startup

### New Session (`/writing-tuner`)

**Ask one question at a time using the interactive selector. Tell the user to run these with `!` so they get the arrow-key menu.**

1. Tell the user:
   > Type this to pick your writing output:
   > `! node "$WT/bin/select.js" --prompt "What writing output are you tuning for?" --options "Tweet / short-form social,Blog post / newsletter,Long-form / essay / story,Marketing copy / ads,General writing style"`

   *Wait for response. Map their selection to output_type.*

2. Ask: **"Want to upload writing samples to establish your voice? Paste text, reference files, or skip to start from scratch."**

   *Wait for response. This one is free-text so no selector needed.*

3. Tell the user:
   > Type this to pick feedback mode:
   > `! node "$WT/bin/select.js" --prompt "Feedback mode?" --options "Terminal (keyboard shortcuts),Browser (click-to-annotate)"`

   *Wait for response.*

**After all questions answered, run setup automatically:**

```bash
node "$WT/bin/cli.js" setup
```

This creates the session directory, copies the guide template (if no existing guide), and acquires the lock. It returns JSON with `guide_state` — handle accordingly:
- `"fresh"`: template copied, ready to go
- `"draft-exists"`: ask user "Found an unsaved draft. Resume or start fresh?"
- `"latest-exists"`: ask user "Found an existing guide. Use it or start fresh?"
  - If "use it": `cp ./writing-guides/guide-latest.md ./writing-guides/guide-draft.md`

If `lock_acquired` is false, check if stale and offer force-unlock.

**If browser mode, start the server in the same step:**
```bash
node "$WT/bin/cli.js" server-start
```
Tell the user the URL from the JSON output.

If samples were provided, analyze them and write initial preferences into the guide.

Then proceed directly to DRAFT.

### Resume Session (`/writing-tuner --guide <path>`)

1. Load the specified guide file
2. Ask for feedback mode
3. Run setup + server-start if browser, then go to DRAFT

## The Loop

### SEED + DRAFT

User provides a prompt or pastes existing writing. After generating/accepting, segment it:

```bash
node "$WT/bin/cli.js" segment "THE DRAFT TEXT HERE" "OUTPUT_TYPE"
```

This segments the text, writes `current-draft.json`, and prints numbered segments.

### ANNOTATE

**Terminal mode:** Read `annotate-terminal.md`. For each annotation command the user types, write it:

```bash
node "$WT/bin/cli.js" annotate '{"segment":2,"words":[0,5],"text":"...","action":"dislike","comment":"too formal"}'
```

**Browser mode:** Read `annotate-browser.md`. The server handles annotations automatically — just wait for user to type `done`.

### EXTRACT

When user signals `done`:

```bash
node "$WT/bin/cli.js" extract
```

Returns JSON with `annotations` array and `warnings`. Tell user about any warnings briefly.

Then get the guide update prompt:

```bash
node "$WT/bin/cli.js" update-prompt --annotations-json 'THE_EXTRACT_OUTPUT'
```

Use that prompt to generate an updated guide. Save it by writing to a temp file (avoids security warnings from multi-line CLI args):

```bash
cat <<'GUIDE_EOF' > /tmp/writing-tuner-draft.md
(your updated guide markdown here)
GUIDE_EOF
node "$WT/bin/cli.js" save-draft --file /tmp/writing-tuner-draft.md
```

Tell the user what preferences were extracted (2-3 sentence summary).

### PROOF

Generate a **fresh** writing sample using ONLY `current_guide` as instructions. Do NOT use prior session context.

The user can provide a prompt or let you pick one for the `output_type`.

Present the proof sample. Then tell the user:

> Type this to choose what's next:
> `! node "$WT/bin/select.js" --prompt "What next?" --options "Accept — save guide and exit,Annotate — mark up this proof sample,Compare variants — see 2-3 versions side by side,Test another prompt — different writing task same guide,Annotate another doc — generate new writing to annotate"`

Handle the selection:
- **Accept** → go to SAVE
- **Annotate** → back to ANNOTATE with the proof sample
- **Compare variants** → generate 2-3 versions, let user pick best, then offer this menu again
- **Test another prompt** → ask for a prompt, generate using guide, then offer this menu again
- **Annotate another doc** → generate a new piece using the current guide (user can provide a prompt or you pick one), then go to ANNOTATE. User can also paste their own writing if they prefer.

### SAVE

On accept:

```bash
node "$WT/bin/cli.js" save-version
```

This saves the versioned guide, releases the lock, and cleans up the session directory — all in one command.

Report to user:
- Guide saved: `./writing-guides/guide-vN.md`
- Latest: `./writing-guides/guide-latest.md`
- Resume anytime: `/writing-tuner --guide ./writing-guides/guide-latest.md`

## Error Recovery

- **Draft exists on startup:** `setup` returns `guide_state: "draft-exists"` — ask user
- **Browser server fails:** fall back to terminal mode, notify user
- **Stale lock:** `setup` returns `lock_acquired: false` — check if stale, offer force-unlock
- **Invalid annotations:** `extract` returns warnings — tell user, continue
- **WT not found:** derive from this skill file's path (two directories up)
