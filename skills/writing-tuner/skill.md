---
name: writing-tuner
description: Iteratively refine AI writing through word-level annotation feedback, building a versioned writing style guide
---

# writing-tuner

You are orchestrating an iterative writing refinement session. The user will give feedback on writing at the word/phrase level, and you will extract their preferences into a growing writing style guide.

## CLI Path

The CLI path is hardcoded below by the install script. Use this exact path for all `node` commands.

CLI_PATH=/Users/ericbrody-moore/Documents/writing-tuner/bin/cli.js

**Replace `{CLI}` in all commands below with the CLI_PATH above. Do NOT search the filesystem. Do NOT run `find` or `ls`. The path is right here.**

## Session State

- `output_type`: tweet | blog-post | long-form | marketing-copy | general
- `mode`: terminal | browser

## Startup

### New Session (`/writing-tuner`)

**Step 1: Ask output type using AskUserQuestion tool.**

Use AskUserQuestion with:
- question: "What writing output are you tuning for?"
- header: "Output"
- multiSelect: false
- options:
  - label: "Tweet / short-form", description: "Tweets, threads, social posts"
  - label: "Blog / newsletter", description: "Articles, email newsletters"
  - label: "Long-form", description: "Essays, stories, scripts"
  - label: "Marketing copy", description: "Ads, landing pages, product descriptions"

(User can select "Other" for general writing style)

Wait for response. Map to output_type.

**Step 2: Ask about writing samples.**

Ask in text: **"Want to upload writing samples to establish your voice? Paste text, reference files, or type 'skip' to start from scratch."**

Wait for response.

**Step 3: Ask feedback mode using AskUserQuestion tool.**

Use AskUserQuestion with:
- question: "Which feedback mode?"
- header: "Mode"
- multiSelect: false
- options:
  - label: "Terminal", description: "Keyboard shortcuts — fast for short-form"
  - label: "Browser", description: "Click-to-annotate web UI — better for longer pieces"

Wait for response.

**Step 4: Run setup.**

```bash
node {CLI} setup
```

**Step 5: MANDATORY — check `guide_state` in the setup response. Do NOT skip this.**

- If `"fresh"`: proceed to step 6
- If `"draft-exists"`: **STOP. Use AskUserQuestion:**
  - question: "Found an unsaved draft from a previous session. What would you like to do?"
  - header: "Draft"
  - options:
    - label: "Resume", description: "Pick up where you left off"
    - label: "Start fresh", description: "Discard old draft and begin new"
  - If user selects "Start fresh": run `node {CLI} setup --fresh`
- If `"latest-exists"`: **STOP. Use AskUserQuestion:**
  - question: "Found an existing writing guide. What would you like to do?"
  - header: "Guide"
  - options:
    - label: "Use it", description: "Continue refining your existing guide"
    - label: "Start fresh", description: "Begin a new guide from scratch"
  - If "Use it": `cp ./writing-guides/guide-latest.md ./writing-guides/guide-draft.md`
  - If "Start fresh": run `node {CLI} setup --fresh`

If `lock_acquired` is false, check if stale and offer force-unlock.

**Step 6: Seed guide from samples (if provided).**

If samples were provided, analyze them and use the **Write tool** to write initial preferences directly to `./writing-guides/guide-draft.md`. Do NOT use the CLI or temp files — just write the file.

**Step 7: Generate the first draft and segment it.**

Either ask for a writing prompt or generate one based on the output type. Then segment:

```bash
node {CLI} segment "THE DRAFT TEXT HERE" "OUTPUT_TYPE"
```

**Step 8: Start server if browser mode.**

The draft text MUST be segmented before starting the server, so the browser has content to display.

```bash
node {CLI} server-start
```
Tell the user the URL from the JSON output. The browser will show the draft text immediately.

### Resume Session (`/writing-tuner --guide <path>`)

1. Load the specified guide file
2. Ask for feedback mode (use AskUserQuestion as above)
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

Use that prompt to generate an updated guide. **Save it using the Write tool** — write directly to `./writing-guides/guide-draft.md`. Do NOT use the CLI save-draft command or temp files.

Tell the user what preferences were extracted (2-3 sentence summary).

### PROOF

Generate a **fresh** writing sample using ONLY `current_guide` as instructions. Do NOT use prior session context.

The user can provide a prompt or let you pick one for the `output_type`.

Present the proof sample. Then **use AskUserQuestion:**

- question: "What would you like to do next?"
- header: "Next"
- multiSelect: false
- options:
  - label: "Accept", description: "Save the guide and exit"
  - label: "Annotate", description: "Mark up this proof sample for another round"
  - label: "Compare variants", description: "See 2-3 different versions side by side"
  - label: "Test another prompt", description: "Try a different writing task with same guide"

(User can select "Other" to annotate a different doc or paste their own writing)

Handle the selection:
- **Accept** → go to SAVE
- **Annotate** → back to ANNOTATE with the proof sample
- **Compare variants** → generate 2-3 versions, let user pick best, then offer this menu again
- **Test another prompt** → ask for a prompt, generate using guide, then offer this menu again
- **Other** → generate a new piece using the current guide (user can provide a prompt or you pick one), then go to ANNOTATE

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

- **Draft exists on startup:** `setup` returns `guide_state: "draft-exists"` — MUST use AskUserQuestion
- **Browser server fails:** fall back to terminal mode, notify user
- **Stale lock:** `setup` returns `lock_acquired: false` — check if stale, offer force-unlock
- **Invalid annotations:** `extract` returns warnings — tell user, continue
