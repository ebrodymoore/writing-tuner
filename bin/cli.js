#!/usr/bin/env node

/**
 * writing-tuner CLI — consolidates multi-step operations into single commands
 * to minimize permission prompts in Claude Code.
 *
 * Usage:
 *   node bin/cli.js setup [--guide-dir ./writing-guides] [--template-path ./templates/guide-template.md]
 *   node bin/cli.js segment <text> <output_type> [--session-dir ./writing-guides/.session]
 *   node bin/cli.js annotate <json> [--session-dir ./writing-guides/.session]
 *   node bin/cli.js extract [--session-dir ./writing-guides/.session]
 *   node bin/cli.js update-prompt [--guide-dir ./writing-guides] [--annotations-json <json>]
 *   node bin/cli.js save-draft <content> [--guide-dir ./writing-guides]
 *   node bin/cli.js save-version [--guide-dir ./writing-guides]
 *   node bin/cli.js server-start [--session-dir ./writing-guides/.session]
 *   node bin/cli.js server-stop [--session-dir ./writing-guides/.session]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function getArg(args, flag, defaultVal) {
  const idx = args.indexOf(flag);
  return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : defaultVal;
}

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {

  // ── SETUP ──────────────────────────────────────────────
  // Creates session dir, copies template if no guide exists, acquires lock.
  // Single command replaces: mkdir + cp + sed + node -e acquireLock
  case 'setup': {
    const guideDir = getArg(args, '--guide-dir', './writing-guides');
    const templatePath = getArg(args, '--template-path',
      path.join(ROOT, 'templates', 'guide-template.md'));
    const sessionDir = path.join(guideDir, '.session');

    fs.mkdirSync(sessionDir, { recursive: true });

    const { acquireLock, loadDraft } = await import(path.join(ROOT, 'lib', 'versioner.js'));

    // Check for existing state
    const latestPath = path.join(guideDir, 'guide-latest.md');
    const draftPath = path.join(guideDir, 'guide-draft.md');
    let guideState = 'fresh';

    if (fs.existsSync(draftPath)) {
      guideState = 'draft-exists';
    } else if (fs.existsSync(latestPath)) {
      guideState = 'latest-exists';
    } else {
      // Copy template
      let template = fs.readFileSync(templatePath, 'utf-8');
      template = template.replace('{date}', new Date().toISOString().slice(0, 10));
      fs.writeFileSync(draftPath, template, 'utf-8');
    }

    const lockAcquired = acquireLock(guideDir);

    console.log(JSON.stringify({
      guide_dir: guideDir,
      session_dir: sessionDir,
      guide_state: guideState,
      lock_acquired: lockAcquired,
    }));
    break;
  }

  // ── SEGMENT ────────────────────────────────────────────
  // Segments text, writes current-draft.json, prints numbered segments.
  // Single command replaces: node -e "import segmentText + writeDraftJson..."
  case 'segment': {
    const text = args[0];
    const outputType = args[1] || 'general';
    const sessionDir = getArg(args, '--session-dir', './writing-guides/.session');

    const { segmentText } = await import(path.join(ROOT, 'lib', 'parser.js'));
    const { writeDraftJson } = await import(path.join(ROOT, 'lib', 'guide-builder.js'));

    const segments = segmentText(text);
    writeDraftJson(sessionDir, outputType, segments, text);

    // Print numbered segments for terminal display
    for (const s of segments) {
      console.log(`[${s.index + 1}] ${s.text}`);
    }
    break;
  }

  // ── ANNOTATE ───────────────────────────────────────────
  // Appends a single annotation JSON line to annotations.jsonl.
  // Replaces: echo '...' >> annotations.jsonl
  case 'annotate': {
    const json = args[0];
    const sessionDir = getArg(args, '--session-dir', './writing-guides/.session');
    fs.appendFileSync(path.join(sessionDir, 'annotations.jsonl'), json.trim() + '\n');
    console.log('ok');
    break;
  }

  // ── EXTRACT ────────────────────────────────────────────
  // Parses, validates, deduplicates annotations. Returns JSON.
  // Single command replaces: node -e "parseAnnotations + validateAnnotations + dedupe..."
  case 'extract': {
    const sessionDir = getArg(args, '--session-dir', './writing-guides/.session');

    const { parseAnnotations, validateAnnotations, deduplicateAnnotations } =
      await import(path.join(ROOT, 'lib', 'parser.js'));

    const jsonlPath = path.join(sessionDir, 'annotations.jsonl');
    if (!fs.existsSync(jsonlPath)) {
      console.log(JSON.stringify({ annotations: [], warnings: ['No annotations file found'] }));
      break;
    }

    const jsonl = fs.readFileSync(jsonlPath, 'utf-8');
    const draft = JSON.parse(fs.readFileSync(path.join(sessionDir, 'current-draft.json'), 'utf-8'));
    const parsed = parseAnnotations(jsonl);
    const { valid, warnings } = validateAnnotations(parsed, draft.segments);
    const deduped = deduplicateAnnotations(valid);

    console.log(JSON.stringify({ annotations: deduped, warnings }));
    break;
  }

  // ── UPDATE-PROMPT ──────────────────────────────────────
  // Generates the guide update prompt from current guide + annotations.
  // Single command replaces: node -e "formatGuideUpdatePrompt..."
  case 'update-prompt': {
    const guideDir = getArg(args, '--guide-dir', './writing-guides');
    const annotationsJson = getArg(args, '--annotations-json', args[0]);

    const { formatGuideUpdatePrompt } = await import(path.join(ROOT, 'lib', 'guide-builder.js'));

    const guide = fs.readFileSync(path.join(guideDir, 'guide-draft.md'), 'utf-8');
    const annotations = JSON.parse(annotationsJson).annotations || JSON.parse(annotationsJson);

    console.log(formatGuideUpdatePrompt(guide, annotations));
    break;
  }

  // ── SAVE-DRAFT ─────────────────────────────────────────
  // Saves updated guide content to guide-draft.md.
  // Reads from --file path OR stdin (piped). Never pass guide content as a CLI arg
  // because multi-line markdown with # characters triggers security warnings.
  //
  // Usage:
  //   node bin/cli.js save-draft --file /tmp/guide-update.md
  //   echo "guide content" | node bin/cli.js save-draft
  case 'save-draft': {
    const guideDir = getArg(args, '--guide-dir', './writing-guides');
    const filePath = getArg(args, '--file', null);

    let content;
    if (filePath) {
      content = fs.readFileSync(filePath, 'utf-8');
    } else {
      // Read from stdin
      const chunks = [];
      for await (const chunk of process.stdin) {
        chunks.push(chunk);
      }
      content = Buffer.concat(chunks).toString('utf-8');
    }

    const { saveDraft } = await import(path.join(ROOT, 'lib', 'versioner.js'));
    saveDraft(guideDir, content);
    console.log('ok');
    break;
  }

  // ── SAVE-VERSION ───────────────────────────────────────
  // Saves final version, releases lock, cleans up session.
  // Single command replaces: node -e "saveVersion + releaseLock" + rm -rf .session
  case 'save-version': {
    const guideDir = getArg(args, '--guide-dir', './writing-guides');

    const { saveVersion, releaseLock } = await import(path.join(ROOT, 'lib', 'versioner.js'));

    const guide = fs.readFileSync(path.join(guideDir, 'guide-draft.md'), 'utf-8');
    const result = saveVersion(guideDir, guide);
    releaseLock(guideDir);

    // Clean up session
    const sessionDir = path.join(guideDir, '.session');
    if (fs.existsSync(sessionDir)) {
      fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    console.log(JSON.stringify(result));
    break;
  }

  // ── SERVER-START ───────────────────────────────────────
  // Starts browser annotation server. Prints connection info.
  case 'server-start': {
    const sessionDir = getArg(args, '--session-dir', './writing-guides/.session');

    const { startServer } = await import(path.join(ROOT, 'server', 'server.js'));
    const { port } = await startServer(sessionDir, 0);

    console.log(JSON.stringify({ type: 'server-started', port, url: `http://localhost:${port}` }));
    // Server keeps running in background
    break;
  }

  // ── ROOT ────────────────────────────────────────────────
  // Prints the repo root path. Useful for the skill to resolve paths.
  case 'root': {
    console.log(ROOT);
    break;
  }

  // ── SELECT ─────────────────────────────────────────────
  // Interactive terminal selector (arrow keys, enter to confirm).
  // Usage: node bin/cli.js select --prompt "Pick one" --options "A,B,C"
  // Falls back to printing first option if not a TTY.
  case 'select': {
    const prompt = getArg(args, '--prompt', 'Select an option:');
    const optionsStr = getArg(args, '--options', '');
    const options = optionsStr.split(',').map(o => o.trim()).filter(o => o.length > 0);

    if (options.length === 0) {
      console.error('No options provided');
      process.exit(1);
    }

    if (!process.stdin.isTTY) {
      console.log(options[0]);
      break;
    }

    let selected = 0;

    function renderMenu() {
      process.stdout.write(`\x1b[${options.length + 2}A\x1b[J`);
      process.stdout.write(`\x1b[1m${prompt}\x1b[0m\n`);
      process.stdout.write('\x1b[2m(↑↓ to move, enter to select)\x1b[0m\n');
      for (let i = 0; i < options.length; i++) {
        if (i === selected) {
          process.stdout.write(`  \x1b[36m❯ ${options[i]}\x1b[0m\n`);
        } else {
          process.stdout.write(`    ${options[i]}\n`);
        }
      }
    }

    // Initial draw
    process.stdout.write(`\x1b[1m${prompt}\x1b[0m\n`);
    process.stdout.write('\x1b[2m(↑↓ to move, enter to select)\x1b[0m\n');
    for (let i = 0; i < options.length; i++) {
      process.stdout.write(i === selected
        ? `  \x1b[36m❯ ${options[i]}\x1b[0m\n`
        : `    ${options[i]}\n`);
    }

    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    await new Promise((resolve) => {
      process.stdin.on('data', (key) => {
        if (key === '\u0003') { process.stdout.write('\n'); process.stdin.setRawMode(false); process.exit(130); }
        if (key === '\r' || key === '\n') {
          process.stdin.setRawMode(false);
          process.stdin.pause();
          process.stdout.write(`\x1b[${options.length + 2}A\x1b[J`);
          process.stdout.write(`${prompt} \x1b[36m${options[selected]}\x1b[0m\n`);
          console.log(options[selected]);
          resolve();
          return;
        }
        if (key === '\u001b[A' || key === 'k') { selected = (selected - 1 + options.length) % options.length; renderMenu(); }
        if (key === '\u001b[B' || key === 'j') { selected = (selected + 1) % options.length; renderMenu(); }
        const num = parseInt(key, 10);
        if (num >= 1 && num <= options.length) { selected = num - 1; renderMenu(); }
      });
    });
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Commands: setup, segment, annotate, extract, update-prompt, save-draft, save-version, server-start, root, select');
    process.exit(1);
}
