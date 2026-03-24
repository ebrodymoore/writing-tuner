---
name: writing-tuner
description: Iteratively refine AI writing through word-level annotation feedback, building a versioned writing style guide
---

# writing-tuner

You are orchestrating an iterative writing refinement session. The user will give feedback on writing at the word/phrase level, and you will extract their preferences into a growing writing style guide.

## Session State

Track these variables throughout the session:
- `output_type`: tweet | blog-post | long-form | marketing-copy | general
- `guide_dir`: directory where guide files are stored (default: `./writing-guides/`)
- `session_dir`: `{guide_dir}/.session`
- `mode`: terminal | browser
- `current_guide`: the current guide markdown content

## Startup

### New Session (`/writing-tuner`)

1. Ask: **"What writing output are you tuning for?"**
   - a) Tweet / short-form social
   - b) Blog post / newsletter
   - c) Long-form / essay / story
   - d) Marketing copy / ads
   - e) General writing style

2. Ask: **"Upload samples?"** — User can paste text or reference files of writing they like. These establish the baseline voice. Skip to start from scratch.

3. Ask: **"Feedback mode?"** — terminal (t) or browser (b). Can switch mid-session.

4. Set up session:
   ```bash
   mkdir -p ./writing-guides/.session
   ```

5. Check for existing guide:
   - If `./writing-guides/guide-latest.md` exists, ask: "Found an existing guide. Use it as starting point or start fresh?"
   - If `./writing-guides/guide-draft.md` exists, ask: "Found an unsaved draft from a previous session. Resume from it or start fresh?"
   - Otherwise, read `templates/guide-template.md` and replace `{date}` with today's date.

6. Acquire lock:
   ```bash
   node -e "import { acquireLock } from './lib/versioner.js'; console.log(acquireLock('./writing-guides'));"
   ```
   If lock fails, check if stale and offer force-unlock.

7. If samples were provided, analyze them and write initial preferences into the guide.

### Resume Session (`/writing-tuner --guide <path>`)

1. Load the specified guide file as `current_guide`
2. Ask for feedback mode (terminal or browser)
3. Set up session directory and lock, then go to DRAFT

## The Loop

### SEED + DRAFT

Either:
- User provides a prompt → generate writing using `current_guide` as style instructions
- User pastes existing writing → accept as-is

After generating/accepting, segment the text and write draft:
```bash
node -e "
import { segmentText } from './lib/parser.js';
import { writeDraftJson } from './lib/guide-builder.js';
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
   import { parseAnnotations, validateAnnotations, deduplicateAnnotations } from './lib/parser.js';
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
   import { formatGuideUpdatePrompt } from './lib/guide-builder.js';
   import fs from 'fs';
   const guide = fs.readFileSync('./writing-guides/guide-draft.md', 'utf-8');
   const annotations = JSON.parse(process.argv[1]).annotations;
   console.log(formatGuideUpdatePrompt(guide, annotations));
   " 'ANNOTATIONS_JSON'
   ```

4. Use that prompt to generate an updated guide. Write the result:
   ```bash
   node -e "
   import { saveDraft } from './lib/versioner.js';
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
import { saveVersion, releaseLock } from './lib/versioner.js';
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
