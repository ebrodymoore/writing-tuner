#!/usr/bin/env node

/**
 * Setup script — writes the repo root path into the skill so it can find CLI/lib/server.
 * Run this once after cloning:
 *
 *   node bin/setup.js
 *
 * Or it runs automatically via `npm run setup`.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const wtRootFile = path.join(ROOT, 'skills', 'writing-tuner', '.wt-root');

fs.writeFileSync(wtRootFile, ROOT, 'utf-8');
console.log(`writing-tuner root set to: ${ROOT}`);
console.log(`Written to: ${wtRootFile}`);
console.log('\nTo install the skill in Claude Code:');
console.log(`  claude config add skills ${path.join(ROOT, 'skills')}`);
