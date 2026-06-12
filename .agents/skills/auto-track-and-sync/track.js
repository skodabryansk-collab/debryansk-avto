#!/usr/bin/env node
/**
 * Auto-track-and-sync utility
 * Detects changed files in the current git repo and outputs them as JSON.
 *
 * Usage:
 *   node track.js                    # List all changed files
 *   node track.js --json             # Output as JSON
 *   node track.js --new-only         # Only files not on GitHub
 *   node track.js --since <commit>   # Since specific commit
 */

const { execSync } = require('child_process');

const BINARY_EXTS = [
  '.webp', '.png', '.jpg', '.jpeg', '.svg', '.pdf', '.mp4',
  '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.gif',
  '.bmp', '.zip', '.tar', '.gz', '.mp3', '.wav', '.avi', '.mov'
];

const args = process.argv.slice(2);
const jsonOutput = args.includes('--json');
const newOnly = args.includes('--new-only');
const sinceIdx = args.indexOf('--since');
const sinceCommit = sinceIdx >= 0 ? args[sinceIdx + 1] : 'HEAD';

function getChangedFiles() {
  try {
    const out = execSync(`git diff --name-only ${sinceCommit}`, { encoding: 'utf8', cwd: process.cwd() });
    return out.trim().split('\n').filter(Boolean);
  } catch (e) {
    // If HEAD doesn't exist, use git status
    const out = execSync('git status --short', { encoding: 'utf8', cwd: process.cwd() });
    return out.trim().split('\n').filter(Boolean).map(line => line.trim().replace(/^[? MADRCU]+\s+/, ''));
  }
}

function classify(files) {
  const source = [];
  const binary = [];
  for (const f of files) {
    const ext = require('path').extname(f).toLowerCase();
    if (BINARY_EXTS.includes(ext)) binary.push(f);
    else source.push(f);
  }
  return { source, binary, all: files };
}

const files = getChangedFiles();
const classified = classify(files);

if (jsonOutput) {
  console.log(JSON.stringify(classified, null, 2));
} else {
  console.log(`Changed files: ${files.length}`);
  console.log(`  Source: ${classified.source.length}`);
  console.log(`  Binary: ${classified.binary.length}`);
  for (const f of files) {
    const type = classified.binary.includes(f) ? '[B]' : '[S]';
    console.log(`  ${type} ${f}`);
  }
}
