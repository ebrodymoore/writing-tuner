# Browser Annotation Mode

## Prerequisites

Ensure `current-draft.json` exists in the session directory (it should have been written by the `segment` command during DRAFT). If not:

```bash
node "$WT/bin/cli.js" segment "THE DRAFT TEXT" "OUTPUT_TYPE"
```

## Starting the Server

The server should have been started during session setup. If not:

```bash
node "$WT/bin/cli.js" server-start
```

Tell the user the URL from the JSON output:
> **Open http://localhost:PORT in your browser.**
> Click or drag to select words, then use the toolbar to annotate.
> Type `done` here when you're finished.

## During Annotation

The user interacts entirely in the browser. Annotations are written to `annotations.jsonl` automatically by the server. You do NOT need to parse terminal input — just wait for the user to type `done`.

If the user asks questions or gives feedback in the terminal while annotating, respond conversationally but remind them to type `done` when ready to proceed.

## When Done

When the user types `done`:

1. Stop the server (kill the background process)
2. Proceed to the EXTRACT step — run `node "$WT/bin/cli.js" extract`

## Switching to Terminal Mode

If the user types `t` to switch to terminal mode:
1. Stop the server
2. Annotations already in `annotations.jsonl` are preserved
3. Read `annotate-terminal.md` and follow it
