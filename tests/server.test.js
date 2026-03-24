import { describe, it, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { startServer, stopServer } from '../server/server.js';

let sessionDir;
let serverHandle;

describe('startServer', () => {
  beforeEach(() => {
    sessionDir = fs.mkdtempSync(path.join(os.tmpdir(), 'wt-server-test-'));
    fs.writeFileSync(
      path.join(sessionDir, 'current-draft.json'),
      JSON.stringify({ text: 'Hello world.', words: ['Hello', 'world.'] })
    );
  });

  afterEach(async () => {
    if (serverHandle) {
      await stopServer(serverHandle);
      serverHandle = null;
    }
    fs.rmSync(sessionDir, { recursive: true, force: true });
  });

  it('starts on a random port and writes .server-info', async () => {
    serverHandle = await startServer(sessionDir, 0);

    assert.ok(serverHandle.port > 0, 'port should be a positive integer');

    const infoPath = path.join(sessionDir, '.server-info');
    assert.ok(fs.existsSync(infoPath), '.server-info should exist');

    const info = JSON.parse(fs.readFileSync(infoPath, 'utf-8'));
    assert.equal(info.port, serverHandle.port);
    assert.equal(info.url, `http://localhost:${serverHandle.port}`);
  });

  it('serves current-draft.json at GET /api/draft', async () => {
    serverHandle = await startServer(sessionDir, 0);
    const { port } = serverHandle;

    const res = await fetch(`http://localhost:${port}/api/draft`);
    assert.equal(res.status, 200);

    const contentType = res.headers.get('content-type');
    assert.ok(contentType.includes('application/json'), `Expected application/json, got ${contentType}`);

    const body = await res.json();
    assert.equal(body.text, 'Hello world.');
  });

  it('accepts annotation POST at /api/annotate and appends to annotations.jsonl', async () => {
    serverHandle = await startServer(sessionDir, 0);
    const { port } = serverHandle;

    const annotation = { start: 0, end: 0, text: 'Hello', action: 'dislike', comment: 'Too terse' };

    const res = await fetch(`http://localhost:${port}/api/annotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    });

    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.ok, true);

    const jsonlPath = path.join(sessionDir, 'annotations.jsonl');
    assert.ok(fs.existsSync(jsonlPath), 'annotations.jsonl should exist');

    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 1);

    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.start, 0);
    assert.equal(parsed.end, 0);
    assert.equal(parsed.action, 'dislike');
    assert.equal(parsed.comment, 'Too terse');
  });

  it('appends multiple annotations as separate lines in annotations.jsonl', async () => {
    serverHandle = await startServer(sessionDir, 0);
    const { port } = serverHandle;

    const annotations = [
      { start: 0, end: 0, text: 'Hello', action: 'like' },
      { start: 1, end: 1, text: 'world.', action: 'dislike' },
      { start: 0, end: 1, text: 'Hello world.', action: 'comment' },
    ];

    for (const ann of annotations) {
      await fetch(`http://localhost:${port}/api/annotate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(ann),
      });
    }

    const jsonlPath = path.join(sessionDir, 'annotations.jsonl');
    const lines = fs.readFileSync(jsonlPath, 'utf-8').trim().split('\n');
    assert.equal(lines.length, 3);

    for (let i = 0; i < annotations.length; i++) {
      const parsed = JSON.parse(lines[i]);
      assert.equal(parsed.start, annotations[i].start);
      assert.equal(parsed.action, annotations[i].action);
    }
  });

  it('responds with CORS headers', async () => {
    serverHandle = await startServer(sessionDir, 0);
    const { port } = serverHandle;

    const res = await fetch(`http://localhost:${port}/api/draft`);
    assert.equal(res.headers.get('access-control-allow-origin'), '*');
  });

  it('handles OPTIONS preflight request with 204', async () => {
    serverHandle = await startServer(sessionDir, 0);
    const { port } = serverHandle;

    const res = await fetch(`http://localhost:${port}/api/annotate`, {
      method: 'OPTIONS',
    });
    assert.equal(res.status, 204);
  });

  it('returns 404 for unknown routes', async () => {
    serverHandle = await startServer(sessionDir, 0);
    const { port } = serverHandle;

    const res = await fetch(`http://localhost:${port}/api/unknown`);
    assert.equal(res.status, 404);
  });
});
