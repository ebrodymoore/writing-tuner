import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  saveDraft,
  loadDraft,
  getLatestVersion,
  saveVersion,
  acquireLock,
  releaseLock,
  refreshLock,
  isLockStale,
} from '../lib/versioner.js';

const TEST_DIR = path.join(import.meta.dirname, '.test-guides');

function setup() {
  if (!fs.existsSync(TEST_DIR)) fs.mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true });
}

describe('saveDraft / loadDraft', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('saves and loads draft content', () => {
    const content = '# My Draft\nSome content here.';
    saveDraft(TEST_DIR, content);
    const loaded = loadDraft(TEST_DIR);
    assert.equal(loaded, content);
  });

  it('returns null when no draft exists', () => {
    const result = loadDraft(TEST_DIR);
    assert.equal(result, null);
  });

  it('overwrites an existing draft', () => {
    saveDraft(TEST_DIR, 'first');
    saveDraft(TEST_DIR, 'second');
    assert.equal(loadDraft(TEST_DIR), 'second');
  });
});

describe('getLatestVersion', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('returns 0 when no versioned files exist', () => {
    assert.equal(getLatestVersion(TEST_DIR), 0);
  });

  it('returns 0 when directory does not exist', () => {
    assert.equal(getLatestVersion(path.join(TEST_DIR, 'nonexistent')), 0);
  });

  it('returns the highest version number', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'guide-v1.md'), 'v1');
    fs.writeFileSync(path.join(TEST_DIR, 'guide-v2.md'), 'v2');
    fs.writeFileSync(path.join(TEST_DIR, 'guide-v5.md'), 'v5');
    assert.equal(getLatestVersion(TEST_DIR), 5);
  });

  it('ignores files that do not match the pattern', () => {
    fs.writeFileSync(path.join(TEST_DIR, 'guide-latest.md'), 'latest');
    fs.writeFileSync(path.join(TEST_DIR, 'guide-draft.md'), 'draft');
    fs.writeFileSync(path.join(TEST_DIR, 'guide-v3.md'), 'v3');
    assert.equal(getLatestVersion(TEST_DIR), 3);
  });
});

describe('saveVersion', () => {
  beforeEach(setup);
  afterEach(teardown);

  it('creates guide-v1.md and guide-latest.md on first save', () => {
    const content = '# Guide v1';
    const result = saveVersion(TEST_DIR, content);
    assert.equal(result.version, 1);
    assert.equal(result.filename, 'guide-v1.md');
    assert.ok(fs.existsSync(path.join(TEST_DIR, 'guide-v1.md')));
    assert.ok(fs.existsSync(path.join(TEST_DIR, 'guide-latest.md')));
    assert.equal(fs.readFileSync(path.join(TEST_DIR, 'guide-v1.md'), 'utf-8'), content);
    assert.equal(fs.readFileSync(path.join(TEST_DIR, 'guide-latest.md'), 'utf-8'), content);
  });

  it('increments version on subsequent saves', () => {
    saveVersion(TEST_DIR, 'v1 content');
    saveVersion(TEST_DIR, 'v2 content');
    const result = saveVersion(TEST_DIR, 'v3 content');
    assert.equal(result.version, 3);
    assert.equal(result.filename, 'guide-v3.md');
    assert.ok(fs.existsSync(path.join(TEST_DIR, 'guide-v3.md')));
  });

  it('updates guide-latest.md to newest content', () => {
    saveVersion(TEST_DIR, 'v1 content');
    saveVersion(TEST_DIR, 'v2 content');
    assert.equal(
      fs.readFileSync(path.join(TEST_DIR, 'guide-latest.md'), 'utf-8'),
      'v2 content'
    );
  });

  it('removes guide-draft.md after saving a version', () => {
    saveDraft(TEST_DIR, 'draft content');
    assert.ok(fs.existsSync(path.join(TEST_DIR, 'guide-draft.md')));
    saveVersion(TEST_DIR, 'final content');
    assert.ok(!fs.existsSync(path.join(TEST_DIR, 'guide-draft.md')));
  });

  it('does not throw if no draft exists when saving version', () => {
    assert.doesNotThrow(() => saveVersion(TEST_DIR, 'content'));
  });
});

describe('lock management', () => {
  beforeEach(setup);
  afterEach(() => {
    releaseLock(TEST_DIR);
    teardown();
  });

  it('acquires a lock when none exists', () => {
    const result = acquireLock(TEST_DIR);
    assert.equal(result, true);
    assert.ok(fs.existsSync(path.join(TEST_DIR, '.lock')));
  });

  it('lock file contains pid and timestamp', () => {
    acquireLock(TEST_DIR);
    const lock = JSON.parse(fs.readFileSync(path.join(TEST_DIR, '.lock'), 'utf-8'));
    assert.equal(lock.pid, process.pid);
    assert.ok(typeof lock.timestamp === 'number');
  });

  it('fails on double acquire (non-stale lock)', () => {
    acquireLock(TEST_DIR);
    const second = acquireLock(TEST_DIR);
    assert.equal(second, false);
  });

  it('releases the lock', () => {
    acquireLock(TEST_DIR);
    releaseLock(TEST_DIR);
    assert.ok(!fs.existsSync(path.join(TEST_DIR, '.lock')));
  });

  it('releaseLock does not throw if no lock exists', () => {
    assert.doesNotThrow(() => releaseLock(TEST_DIR));
  });

  it('allows re-acquire after release', () => {
    acquireLock(TEST_DIR);
    releaseLock(TEST_DIR);
    assert.equal(acquireLock(TEST_DIR), true);
  });

  it('detects a stale lock (timestamp > 60s old)', () => {
    const lockPath = path.join(TEST_DIR, '.lock');
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, timestamp: Date.now() - 61_000 }));
    assert.equal(isLockStale(TEST_DIR), true);
  });

  it('reports non-stale for a fresh lock', () => {
    acquireLock(TEST_DIR);
    assert.equal(isLockStale(TEST_DIR), false);
  });

  it('acquires over a stale lock', () => {
    const lockPath = path.join(TEST_DIR, '.lock');
    fs.writeFileSync(lockPath, JSON.stringify({ pid: 99999, timestamp: Date.now() - 61_000 }));
    assert.equal(acquireLock(TEST_DIR), true);
  });

  it('isLockStale returns false when no lock exists', () => {
    assert.equal(isLockStale(TEST_DIR), false);
  });

  it('isLockStale returns true for corrupt lock content', () => {
    fs.writeFileSync(path.join(TEST_DIR, '.lock'), 'not valid json{{');
    assert.equal(isLockStale(TEST_DIR), true);
  });

  it('refreshLock updates the timestamp', async () => {
    acquireLock(TEST_DIR);
    const lockPath = path.join(TEST_DIR, '.lock');
    const before = JSON.parse(fs.readFileSync(lockPath, 'utf-8')).timestamp;
    // Write a slightly older timestamp to ensure refresh changes it
    fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, timestamp: before - 5000 }));
    refreshLock(TEST_DIR);
    const after = JSON.parse(fs.readFileSync(lockPath, 'utf-8')).timestamp;
    assert.ok(after > before - 5000, 'timestamp should be updated by refreshLock');
  });

  it('refreshLock does not throw if no lock exists', () => {
    assert.doesNotThrow(() => refreshLock(TEST_DIR));
  });
});
