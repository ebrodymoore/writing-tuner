---
name: writing-tuner
description: Iteratively refine AI writing through word-level annotation feedback, building a versioned writing style guide
---

# writing-tuner

You are orchestrating an iterative writing refinement session. The user will give feedback on writing at the word/phrase level, and you will extract their preferences into a growing writing style guide.

## Path Resolution

**CRITICAL:** This skill's JS files live in the writing-tuner repo, NOT in the user's project. Before doing anything else, find the repo root:

```bash
WRITING_TUNER_ROOT="$(dirname "$(dirname "$(find ~/.claude -path '*/writing-tuner/skills/writing-tuner/skill.md' -print -quit 2>/dev/null)")")"
echo "$WRITING_TUNER_ROOT"
```

If that doesn't find it, try:
```bash
WRITING_TUNER_ROOT="$(find / -maxdepth 5 -path '*/writing-tuner/lib/parser.js' -print -quit 2>/dev/null | sed 's|/lib/parser.js||')"
echo "$WRITING_TUNER_ROOT"
```

Save this path. All `node` commands below use `$WRITING_TUNER_ROOT` to reference lib/, server/, and templates/.

The **guide files** (`writing-guides/`) live in the user's current working directory.

## Session State

Track these variables throughout the session:
- `WRITING_TUNER_ROOT`: absolute path to the writing-tuner repo
- `output_type`: tweet | blog-post | long-form | marketing-copy | general
- `guide_dir`: `./writing-guides/` (in user's project)
- `session_dir`: `./writing-guides/.session`
- `mode`: terminal | browser
- `current_guide`: the current guide markdown content

## Startup

### New Session (`/writing-tuner`)

**Ask these questions one at a time. Wait for the user's response before asking the next.**

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

**After all questions are answered, automatically run the setup — do NOT wait or ask permission:**

```bash
mkdir -p ./writing-guides/.session
```

Check for existing guide:
- If `./writing-guides/guide-latest.md` exists, ask: "Found an existing guide. Use it as starting point or start fresh?"
- If `./writing-guides/guide-draft.md` exists, ask: "Found an unsaved draft from a previous session. Resume from it or start fresh?"
- Otherwise, copy the template:
  ```bash
  cp "$WRITING_TUNER_ROOT/templates/guide-template.md" ./writing-guides/guide-draft.md
  sed -i '' "s/{date}/$(date +%Y-%m-%d)/" ./writing-guides/guide-draft.md
  ```

Acquire lock:
```bash
node -e "import { acquireLock } from '$WRITING_TUNER_ROOT/lib/versioner.js'; console.log(acquireLock('./writing-guides'));"
```
If lock fails, check if stale and offer force-unlock.

If browser mode was selected, **start the server immediately:**
```bash
node "$WRITING_TUNER_ROOT/server/server.js" --session-dir ./writing-guides/.session --port 0 &
cat ./writing-guides/.session/.server-info
```
Tell the user the URL to open.

If samples were provided, analyze them and write initial preferences into the guide.

Then proceed directly to DRAFT — do not wait for another prompt.

### Resume Session (`/writing-tuner --guide <path>`)

1. Load the specified guide file as `current_guide`
2. Ask for feedback mode (terminal or browser)
3. Set up session directory, lock, and server (if browser), then go to DRAFT

## The Loop

### SEED + DRAFT

Either:
- User provides a prompt → generate writing using `current_guide` as style instructions
- User pastes existing writing → accept as-is

After generating/accepting, segment the text and write draft:
```bash
node -e "
import { segmentText } from '$WRITING_TUNER_ROOT/lib/parser.js';
import { writeDraftJson } from '$WRITING_TUNER_ROOT/lib/guide-builder.js';
const raw = process.argv[1];
const segments = segmentText(raw);
writeDraftJson('./writing-guides/.session', 'OUTPUT_TYPE', segments, raw);
segments.forEach((s) => console.log('[' + (s.index + 1) + '] ' + s.text));
" 'THE DRAFT TEXT HERE'
```

### ANNOTATE

Read the appropriate sub-skill for the chosen mode:
- Terminal: read `skills/writing-tuner/annotate-terminal.md` and follow it
- Browser: read `skills/writing-tuner/annotate-browser.md` and follow it

Collect annotations until the user signals `done`.

### EXTRACT

1. Parse and validate annotations:
   ```bash
   node -e "
   import { parseAnnotations, validateAnnotations, deduplicateAnnotations } from '$WRITING_TUNER_ROOT/lib/parser.js';
   import fs from 'fs';
   const jsonl = fs.readFileSync('./writing-guides/.session/annotations.jsonl', 'utf-8');
   const draft = JSON.parse(fs.readFileSync('./writing-guides/.session/current-draft.json', 'utf-8'));
   const parsed = parseAnnotations(jsonl);
   const { valid, warnings } = validateAnnotations(parsed, draft.segments);
   const deduped = deduplicateAnnotations(valid);
   console.log(JSON.stringify({ annotations: deduped, warnings }));
   "
   ```

2. If there are warnings, tell the user briefly.

3. Generate the guide update prompt:
   ```bash
   node -e "
   import { formatGuideUpdatePrompt } from '$WRITING_TUNER_ROOT/lib/guide-builder.js';
   import fs from 'fs';
   const guide = fs.readFileSync('./writing-guides/guide-draft.md', 'utf-8');
   const annotations = JSON.parse(process.argv[1]).annotations;
   console.log(formatGuideUpdatePrompt(guide, annotations));
   " 'ANNOTATIONS_JSON'
   ```

4. Use that prompt to generate an updated guide. Write the result:
   ```bash
   node -e "
   import { saveDraft } from '$WRITING_TUNER_ROOT/lib/versioner.js';
   saveDraft('./writing-guides', process.argv[1]);
   " 'UPDATED_GUIDE_MARKDOWN'
   ```

5. Tell the user what preferences were extracted (2-3 sentence summary).

### PROOF

Generate a **fresh** writing sample using ONLY `current_guide` as instructions. Do NOT use prior session context — this tests whether the guide alone produces good writing.

The user can:
- Provide a prompt for the proof ("write a tweet about X")
- Or let you pick one appropriate for the `output_type`

Present the proof sample. Then offer:

**What next?**
- **a) Accept** — save guide and exit
- **b) Annotate** — mark up this proof sample (back to ANNOTATE)
- **c) Compare variants** — I'll generate 2-3 versions, you pick the best
- **d) Test another prompt** — try a different writing task with the same guide
- **e) Annotate another doc** — paste or upload new writing to annotate

### SAVE

On accept:
```bash
node -e "
import { saveVersion, releaseLock } from '$WRITING_TUNER_ROOT/lib/versioner.js';
import fs from 'fs';
const guide = fs.readFileSync('./writing-guides/guide-draft.md', 'utf-8');
const result = saveVersion('./writing-guides', guide);
releaseLock('./writing-guides');
console.log(JSON.stringify(result));
"
```

Clean up session dir:
```bash
rm -rf ./writing-guides/.session
```

Report to user:
- Guide saved: `./writing-guides/guide-vN.md`
- Latest: `./writing-guides/guide-latest.md`
- Resume anytime: `/writing-tuner --guide ./writing-guides/guide-latest.md`

## Error Recovery

- **Draft exists on startup:** ask "Resume from unsaved draft or start fresh?"
- **Browser server fails:** fall back to terminal mode, notify user
- **Stale lock:** if `.lock` exists and is stale (>60s), ask user to force-unlock
- **Invalid annotations:** skip them, warn user, continue
- **WRITING_TUNER_ROOT not found:** ask user for the path to their writing-tuner clone
