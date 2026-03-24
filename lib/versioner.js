import fs from 'node:fs';
import path from 'node:path';

const DRAFT_FILE = 'guide-draft.md';
const LATEST_FILE = 'guide-latest.md';
const LOCK_FILE = '.lock';
const STALE_THRESHOLD_MS = 60_000;

export function saveDraft(guideDir, content) {
  fs.writeFileSync(path.join(guideDir, DRAFT_FILE), content, 'utf-8');
}

export function loadDraft(guideDir) {
  const p = path.join(guideDir, DRAFT_FILE);
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p, 'utf-8');
}

export function getLatestVersion(guideDir) {
  if (!fs.existsSync(guideDir)) return 0;
  const files = fs.readdirSync(guideDir);
  let max = 0;
  for (const f of files) {
    const match = f.match(/^guide-v(\d+)\.md$/);
    if (match) max = Math.max(max, parseInt(match[1], 10));
  }
  return max;
}

export function saveVersion(guideDir, content) {
  const version = getLatestVersion(guideDir) + 1;
  const filename = `guide-v${version}.md`;
  fs.writeFileSync(path.join(guideDir, filename), content, 'utf-8');
  fs.writeFileSync(path.join(guideDir, LATEST_FILE), content, 'utf-8');
  const draftPath = path.join(guideDir, DRAFT_FILE);
  if (fs.existsSync(draftPath)) fs.unlinkSync(draftPath);
  return { version, filename };
}

export function acquireLock(guideDir) {
  const lockPath = path.join(guideDir, LOCK_FILE);
  if (fs.existsSync(lockPath) && !isLockStale(guideDir)) {
    return false;
  }
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, timestamp: Date.now() }));
  return true;
}

export function releaseLock(guideDir) {
  const lockPath = path.join(guideDir, LOCK_FILE);
  if (fs.existsSync(lockPath)) fs.unlinkSync(lockPath);
}

export function refreshLock(guideDir) {
  const lockPath = path.join(guideDir, LOCK_FILE);
  if (!fs.existsSync(lockPath)) return;
  const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
  lock.timestamp = Date.now();
  fs.writeFileSync(lockPath, JSON.stringify(lock));
}

export function isLockStale(guideDir) {
  const lockPath = path.join(guideDir, LOCK_FILE);
  if (!fs.existsSync(lockPath)) return false;
  try {
    const lock = JSON.parse(fs.readFileSync(lockPath, 'utf-8'));
    return Date.now() - lock.timestamp > STALE_THRESHOLD_MS;
  } catch {
    return true;
  }
}
