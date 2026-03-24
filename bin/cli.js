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
import { spawn } from 'node:child_process';

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
  // Pass --fresh to wipe stale state and start clean.
  case 'setup': {
    const guideDir = getArg(args, '--guide-dir', './writing-guides');
    const templatePath = getArg(args, '--template-path',
      path.join(ROOT, 'templates', 'guide-template.md'));
    const sessionDir = path.join(guideDir, '.session');
    const fresh = args.includes('--fresh');

    const { acquireLock } = await import(path.join(ROOT, 'lib', 'versioner.js'));

    const latestPath = path.join(guideDir, 'guide-latest.md');
    const draftPath = path.join(guideDir, 'guide-draft.md');
    let guideState = 'fresh';

    if (fresh) {
      // Wipe stale state
      if (fs.existsSync(draftPath)) fs.unlinkSync(draftPath);
      if (fs.existsSync(sessionDir)) fs.rmSync(sessionDir, { recursive: true, force: true });
    }

    fs.mkdirSync(sessionDir, { recursive: true });

    if (fresh || (!fs.existsSync(draftPath) && !fs.existsSync(latestPath))) {
      // Copy template
      let template = fs.readFileSync(templatePath, 'utf-8');
      template = template.replace('{date}', new Date().toISOString().slice(0, 10));
      fs.writeFileSync(draftPath, template, 'utf-8');
      guideState = 'fresh';
    } else if (fs.existsSync(draftPath)) {
      guideState = 'draft-exists';
    } else if (fs.existsSync(latestPath)) {
      guideState = 'latest-exists';
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
  // Spawns browser server as a detached process and exits immediately.
  // The old approach ran the server in-process, which blocked Claude Code's
  // Bash tool indefinitely (it waits for the process to exit).
  case 'server-start': {
    const sessionDir = getArg(args, '--session-dir', './writing-guides/.session');
    const serverScript = path.join(ROOT, 'server', 'server.js');

    // Clean up stale .server-info from previous runs
    const infoPath = path.join(sessionDir, '.server-info');
    if (fs.existsSync(infoPath)) fs.unlinkSync(infoPath);

    // Spawn detached server — it writes .server-info on startup
    const child = spawn(process.execPath, [serverScript, '--session-dir', sessionDir, '--port', '0'], {
      detached: true,
      stdio: 'ignore',
    });
    child.unref();

    // Poll for .server-info (server writes it on listen)
    let info = null;
    for (let i = 0; i < 20; i++) {
      if (fs.existsSync(infoPath)) {
        try {
          info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
          break;
        } catch { /* file not fully written yet */ }
      }
      await new Promise(r => setTimeout(r, 100));
    }

    if (info) {
      console.log(JSON.stringify({ type: 'server-started', ...info }));
    } else {
      console.error('Server failed to start within 2 seconds');
      process.exit(1);
    }
    break;
  }

  // ── ROOT ────────────────────────────────────────────────
  // Prints the repo root path. Useful for the skill to resolve paths.
  case 'root': {
    console.log(ROOT);
    break;
  }

  default:
    console.error(`Unknown command: ${command}`);
    console.error('Commands: setup, segment, annotate, extract, update-prompt, save-version, server-start, root');
    process.exit(1);
}
