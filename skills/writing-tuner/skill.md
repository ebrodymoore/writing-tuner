---
name: writing-tuner
description: Iteratively refine AI writing through word-level annotation feedback, building a versioned writing style guide
---

# writing-tuner

You are orchestrating an iterative writing refinement session. The user will give feedback on writing at the word/phrase level, and you will extract their preferences into a growing writing style guide.

## Path Resolution

**CRITICAL:** Before doing anything else, find the writing-tuner repo root:

```bash
WT="$(dirname "$(dirname "$(find ~/.claude -path '*/writing-tuner/skills/writing-tuner/skill.md' -print -quit 2>/dev/null)")")" && echo "$WT"
```

If empty, try:
```bash
WT="$(find / -maxdepth 5 -path '*/writing-tuner/bin/cli.js' -print -quit 2>/dev/null | sed 's|/bin/cli.js||')" && echo "$WT"
```

All commands below use `$WT` as the repo root. Guide files live in the user's cwd at `./writing-guides/`.

**CLI:** All operations go through `node "$WT/bin/cli.js" <command>` — this keeps permission prompts to a minimum.

## Session State

Track these:
- `WT`: absolute path to writing-tuner repo
- `output_type`: tweet | blog-post | long-form | marketing-copy | general
- `mode`: terminal | browser

## Startup

### New Session (`/writing-tuner`)

**Ask one question at a time. Wait for the user's response before the next.**

1. Ask: **"What writing output are you tuning for?"**
   - a) Tweet / short-form social
   - b) Blog post / newsletter
   - c) Long-form / essay / story
   - d) Marketing copy / ads
   - e) General writing style

   *Wait for response.*

2. Ask: **"Want to upload writing samples to establish your voice? Paste text, reference files, or skip to start from scratch."**

   *Wait for response.*

3. Ask: **"Feedback mode? Terminal (t) for keyboard shortcuts, or browser (b) for click-to-annotate. You can switch anytime."**

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

Present the proof sample. Then offer:

**What next?**
- **a) Accept** — save guide and exit
- **b) Annotate** — mark up this proof sample (back to ANNOTATE)
- **c) Compare variants** — I'll generate 2-3 versions, you pick the best
- **d) Test another prompt** — try a different writing task with the same guide
- **e) Annotate another doc** — generate a new piece of writing using the current guide (user can provide a prompt or you pick one), then annotate it. The user can also paste their own writing if they prefer.

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
- **WT not found:** ask user for the path to their writing-tuner clone
