import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { startServer, stopServer } from '../server/server.js';

const TEST_DIR = path.join(import.meta.dirname, '.test-browser');

describe('browser annotation integration', () => {
  let server;

  beforeEach(() => {
    fs.mkdirSync(TEST_DIR, { recursive: true });
    fs.writeFileSync(
      path.join(TEST_DIR, 'current-draft.json'),
      JSON.stringify({
        output_type: 'tweet',
        words: ['Hello', 'world.', 'Test', 'sentence.'],
        raw: 'Hello world. Test sentence.',
      })
    );
  });

  afterEach(async () => {
    if (server) await stopServer(server);
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('serves index.html at root', async () => {
    server = await startServer(TEST_DIR, 0);
    const res = await fetch(`http://localhost:${server.port}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.ok(html.includes('writing-tuner'));
    assert.ok(html.includes('draft-container'));
  });

  it('accepts well-formed annotation and writes correct JSONL', async () => {
    server = await startServer(TEST_DIR, 0);
    const annotation = {
      start: 0,
      end: 0,
      text: 'Hello',
      action: 'dislike',
      comment: 'too generic',
    };
    const res = await fetch(`http://localhost:${server.port}/api/annotate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(annotation),
    });
    assert.equal(res.status, 200);
    const lines = fs.readFileSync(path.join(TEST_DIR, 'annotations.jsonl'), 'utf-8').trim().split('\n');
    const parsed = JSON.parse(lines[0]);
    assert.equal(parsed.start, 0);
    assert.equal(parsed.end, 0);
    assert.equal(parsed.action, 'dislike');
    assert.equal(parsed.comment, 'too generic');
  });

  it('accumulates multiple annotations in JSONL', async () => {
    server = await startServer(TEST_DIR, 0);
    const url = `http://localhost:${server.port}/api/annotate`;
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start: 0, end: 0, text: 'Hello', action: 'like' }) });
    await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ start: 2, end: 3, text: 'Test sentence.', action: 'dislike' }) });
    const lines = fs.readFileSync(path.join(TEST_DIR, 'annotations.jsonl'), 'utf-8').trim().split('\n');
    assert.equal(lines.length, 2);
  });
});
