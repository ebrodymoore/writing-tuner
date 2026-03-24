# Terminal Annotation Mode

## Displaying the Draft

The draft text should already be segmented and displayed with 1-based line numbers from the DRAFT step:

```
[1] We're incredibly excited to announce
[2] our revolutionary new platform.
[3] Try it today.
```

Show the command reference:

```
Commands:
  +N           Like entire segment N        -N           Dislike entire segment N
  +N:W-W       Like words W-W in N          -N:W-W       Dislike words W-W in N
  -N "reason"  Dislike with comment          sN "text"    Suggest replacement for N
  sN:W-W "x"  Suggest for specific words    m            Switch to browser mode
  done         Finish annotating
```

All segment and word numbers are **1-based** in terminal commands.

## Collecting Input

Read the user's commands one at a time. For each command, parse it and write the annotation:

```bash
node {CLI} annotate '{"segment":2,"words":[0,5],"text":"...","action":"dislike","comment":"too formal"}'
```

**Parsing rules:**

| Command | Parsed annotation |
|---------|------------------|
| `+3` | `{"segment":2,"words":[0,LAST],"text":"full segment text","action":"like"}` |
| `-3` | `{"segment":2,"words":[0,LAST],"text":"full segment text","action":"dislike"}` |
| `+3:2-5` | `{"segment":2,"words":[1,4],"text":"words 2-5","action":"like"}` |
| `-3 "too formal"` | `{"segment":2,"words":[0,LAST],"text":"...","action":"dislike","comment":"too formal"}` |
| `sN "use X"` | `{"segment":N-1,"words":[0,LAST],"text":"...","action":"suggest","replacement":"use X"}` |
| `sN:W-W "x"` | `{"segment":N-1,"words":[W1-1,W2-1],"text":"...","action":"suggest","replacement":"x"}` |

**Index conversion:** Subtract 1 from segment and word numbers (terminal is 1-based, JSON is 0-based).

**LAST** = last word index in the segment (segment.words.length - 1).

To resolve `text`: look up the segment from `current-draft.json`, extract `words[start..end]`, join with spaces.

**Batching:** If the user gives multiple annotations in one message, batch them into a single `annotate` call.

## Flow Control

- **`done`** — finish annotation, proceed to EXTRACT
- **`m`** — switch to browser mode. Read `annotate-browser.md` and follow it. Existing annotations are preserved.
- Unrecognized input: ask user to try again, re-show command reference.
