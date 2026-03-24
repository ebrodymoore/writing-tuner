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

Read the user's commands one at a time. For each command, parse it and write a JSON line to `./writing-guides/.session/annotations.jsonl`.

**Parsing rules:**

| Command | Parsed annotation |
|---------|------------------|
| `+3` | `{"segment":2,"words":[0,LAST],"text":"full segment text","action":"like"}` |
| `-3` | `{"segment":2,"words":[0,LAST],"text":"full segment text","action":"dislike"}` |
| `+3:2-5` | `{"segment":2,"words":[1,4],"text":"words 2-5","action":"like"}` |
| `-3 "too formal"` | `{"segment":2,"words":[0,LAST],"text":"...","action":"dislike","comment":"too formal"}` |
| `sN "use X"` | `{"segment":N-1,"words":[0,LAST],"text":"...","action":"suggest","replacement":"use X"}` |
| `sN:W-W "x"` | `{"segment":N-1,"words":[W1-1,W2-1],"text":"...","action":"suggest","replacement":"x"}` |

**Index conversion:** Subtract 1 from segment number and word numbers when writing JSON (terminal is 1-based, JSON is 0-based).

**LAST** means the last word index in the segment (segment.words.length - 1).

To resolve the `text` field: look up the segment from `current-draft.json`, extract `words[start..end]`, join with spaces.

Write each annotation as a JSON line:
```bash
echo '{"segment":2,"words":[0,5],"text":"...","action":"dislike","comment":"too formal"}' >> ./writing-guides/.session/annotations.jsonl
```

## Flow Control

- **`done`** — finish annotation, proceed to EXTRACT
- **`m`** — switch to browser mode. Read `annotate-browser.md` and follow it. Any annotations already written to `annotations.jsonl` are preserved.
- If the user types something that doesn't match a command, ask them to try again and re-show the command reference.
