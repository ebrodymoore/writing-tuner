# Browser Annotation Mode

## Prerequisites

Ensure `current-draft.json` exists in the session directory (written by the `segment` command during DRAFT). If not:

```bash
node {CLI} segment "THE DRAFT TEXT" "OUTPUT_TYPE"
```

## Starting the Server

The server should have been started during session setup. If not:

```bash
node {CLI} server-start
```

Tell the user the URL from the JSON output:
> **Open http://localhost:PORT in your browser.**
> Click or drag to select words, then use the toolbar to annotate.
> Type `done` here when you're finished.

## During Annotation

The user interacts entirely in the browser. Annotations are written to `annotations.jsonl` automatically by the server. You do NOT need to parse terminal input — just wait for the user to type `done`.

## When Done

When the user types `done`:

1. Stop the server (kill the background process)
2. Proceed to the EXTRACT step — run `node {CLI} extract`

## Switching to Terminal Mode

If the user types `t`:
1. Stop the server
2. Existing annotations are preserved
3. Read `annotate-terminal.md` and follow it
