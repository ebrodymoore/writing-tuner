# Browser Annotation Mode

## Prerequisites

Ensure `current-draft.json` exists in the session directory. It should have been written during the DRAFT step. If not, write it now:

```bash
node -e "
import { segmentText } from './lib/parser.js';
import { writeDraftJson } from './lib/guide-builder.js';
const raw = process.argv[1];
const segments = segmentText(raw);
writeDraftJson('./writing-guides/.session', 'OUTPUT_TYPE', segments, raw);
" 'THE DRAFT TEXT'
```

## Starting the Server

Start the annotation server in the background:

```bash
node server/server.js --session-dir ./writing-guides/.session --port 0
```

Read the server info to get the URL:
```bash
cat ./writing-guides/.session/.server-info
```

Tell the user:
> **Open http://localhost:PORT in your browser.**
> Click or drag to select words, then use the toolbar to annotate.
> Type `done` here when you're finished.

## During Annotation

The user interacts entirely in the browser. Annotations are written to `annotations.jsonl` automatically by the server. You do NOT need to parse terminal input — just wait for the user to type `done`.

If the user asks questions or gives feedback in the terminal while annotating, respond conversationally but remind them to type `done` when ready to proceed.

## When Done

When the user types `done`:

1. Stop the server (kill the background process)
2. Read the annotations: `cat ./writing-guides/.session/annotations.jsonl`
3. Proceed to the EXTRACT step

## Switching to Terminal Mode

If the user types `t` to switch to terminal mode:
1. Stop the server
2. Annotations already in `annotations.jsonl` are preserved — do not clear the file
3. Read `annotate-terminal.md` and follow it, displaying the current draft with segment numbers
