---
name: writing-tuner
description: Iteratively refine AI writing through word-level annotation feedback, building a versioned writing style guide
---

# writing-tuner

You are orchestrating an iterative writing refinement session. The user will give feedback on writing at the word/phrase level, and you will extract their preferences into a growing writing style guide.

## CLI Path

The CLI path is hardcoded below by the install script. Use this exact path for all `node` commands.

CLI_PATH=/Users/ericbrody-moore/Documents/writing-tuner/bin/cli.js

All commands in this skill use: `node {CLI_PATH} <command> [args]`

**Replace `{CLI}` in all commands below with the CLI_PATH above. Do NOT search the filesystem. Do NOT run `find` or `ls` to locate files. The path is right here.**

## Session State

- `output_type`: tweet | blog-post | long-form | marketing-copy | general
- `mode`: terminal | browser

## Startup

### New Session (`/writing-tuner`)

**Ask one question at a time. For menu choices, tell the user to run the interactive selector with `!`.**

1. Tell the user to run the selector (substitute the resolved CLI path):
   > Pick your writing output — type this:
   > `! node {CLI} select --prompt "What writing output are you tuning for?" --options "Tweet / short-form social,Blog post / newsletter,Long-form / essay / story,Marketing copy / ads,General writing style"`

   *Wait for response. Map their selection to output_type.*

2. Ask: **"Want to upload writing samples to establish your voice? Paste text, reference files, or skip to start from scratch."**

   *Wait for response.*

3. Tell the user to run the selector:
   > Pick feedback mode — type this:
   > `! node {CLI} select --prompt "Feedback mode?" --options "Terminal (keyboard shortcuts),Browser (click-to-annotate)"`

   *Wait for response.*

**After all questions answered, run setup automatically:**

```bash
node {CLI} setup
```

This creates the session directory, copies the guide template (if no existing guide), and acquires the lock. Returns JSON with `guide_state`:
- `"fresh"`: template copied, ready to go
- `"draft-exists"`: ask user "Found an unsaved draft. Resume or start fresh?"
- `"latest-exists"`: ask user "Found an existing guide. Use it or start fresh?"
  - If "use it": `cp ./writing-guides/guide-latest.md ./writing-guides/guide-draft.md`

If `lock_acquired` is false, check if stale and offer force-unlock.

**If browser mode, start the server:**
```bash
node {CLI} server-start
```
Tell the user the URL from the JSON output.

If samples were provided, analyze them and write initial preferences into the guide.

Then proceed directly to DRAFT.

### Resume Session (`/writing-tuner --guide <path>`)

1. Load the specified guide file
2. Ask for feedback mode (use selector)
3. Run setup + server-start if browser, then go to DRAFT

## The Loop

### SEED + DRAFT

User provides a prompt or pastes existing writing. After generating/accepting, segment it:

```bash
node {CLI} segment "THE DRAFT TEXT HERE" "OUTPUT_TYPE"
```

This segments the text, writes `current-draft.json`, and prints numbered segments.

### ANNOTATE

**Terminal mode:** Read `annotate-terminal.md`. For each annotation command, write it:

```bash
node {CLI} annotate '{"segment":2,"words":[0,5],"text":"...","action":"dislike","comment":"too formal"}'
```

**Browser mode:** Read `annotate-browser.md`. The server handles annotations automatically — just wait for user to type `done`.

### EXTRACT

When user signals `done`:

```bash
node {CLI} extract
```

Returns JSON with `annotations` array and `warnings`. Tell user about any warnings briefly.

Then get the guide update prompt:

```bash
node {CLI} update-prompt --annotations-json 'THE_EXTRACT_OUTPUT'
```

Use that prompt to generate an updated guide. Save it by writing to a temp file:

```bash
cat <<'GUIDE_EOF' > /tmp/writing-tuner-draft.md
(your updated guide markdown here)
GUIDE_EOF
node {CLI} save-draft --file /tmp/writing-tuner-draft.md
```

Tell the user what preferences were extracted (2-3 sentence summary).

### PROOF

Generate a **fresh** writing sample using ONLY `current_guide` as instructions. Do NOT use prior session context.

The user can provide a prompt or let you pick one for the `output_type`.

Present the proof sample. Then tell the user to run the selector:

> Choose what's next — type this:
> `! node {CLI} select --prompt "What next?" --options "Accept — save guide and exit,Annotate — mark up this proof sample,Compare variants — see 2-3 versions side by side,Test another prompt — different writing task same guide,Annotate another doc — generate new writing to annotate"`

Handle the selection:
- **Accept** → go to SAVE
- **Annotate** → back to ANNOTATE with the proof sample
- **Compare variants** → generate 2-3 versions, let user pick best, then offer this menu again
- **Test another prompt** → ask for a prompt, generate using guide, then offer this menu again
- **Annotate another doc** → generate a new piece using the current guide (user can provide a prompt or you pick one), then go to ANNOTATE. User can also paste their own writing if they prefer.

### SAVE

On accept:

```bash
node {CLI} save-version
```

This saves the versioned guide, releases the lock, and cleans up the session — all in one command.

Report to user:
- Guide saved: `./writing-guides/guide-vN.md`
- Latest: `./writing-guides/guide-latest.md`
- Resume anytime: `/writing-tuner --guide ./writing-guides/guide-latest.md`

## Error Recovery

- **Draft exists on startup:** `setup` returns `guide_state: "draft-exists"` — ask user
- **Browser server fails:** fall back to terminal mode, notify user
- **Stale lock:** `setup` returns `lock_acquired: false` — check if stale, offer force-unlock
- **Invalid annotations:** `extract` returns warnings — tell user, continue
