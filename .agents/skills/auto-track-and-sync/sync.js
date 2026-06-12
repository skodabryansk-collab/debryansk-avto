/**
 * Quick-sync utility for GitHub
 * Syncs only changed files to the remote repo via GitHub Contents API.
 *
 * Usage:
 *   const { quickSync } = await import('./sync.js');
 *   const result = await quickSync({ token, owner, repo, delayMs: 50 });
 *   console.log(result.new, result.updated, result.unchanged, result.failed);
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BINARY_EXTS = [
  '.webp', '.png', '.jpg', '.jpeg', '.svg', '.pdf', '.mp4',
  '.ico', '.woff', '.woff2', '.ttf', '.otf', '.eot', '.gif',
  '.bmp', '.zip', '.tar', '.gz', '.mp3', '.wav', '.avi', '.mov'
];

async function getChangedFiles() {
  try {
    const out = execSync('git diff --name-only HEAD', { encoding: 'utf8', cwd: process.cwd() });
    return out.trim().split('\n').filter(Boolean);
  } catch (e) {
    const out = execSync('git status --short', { encoding: 'utf8', cwd: process.cwd() });
    return out.trim().split('\n').filter(Boolean).map(line => line.trim().replace(/^[? MADRCU]+\s+/, ''));
  }
}

async function getSha(token, owner, repo, filePath) {
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
  const r = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
  if (!r.ok) return null;
  const data = await r.json();
  return data.sha;
}

async function uploadFile(token, owner, repo, filePath, delayMs) {
  const fullPath = path.join(process.cwd(), filePath);
  if (!fs.existsSync(fullPath)) return { ok: false, f: filePath, error: 'File not found' };
  const size = fs.statSync(fullPath).size;
  if (size > 1_000_000) return { ok: false, f: filePath, error: 'File >1MB' };

  const content = fs.readFileSync(fullPath);
  const b64 = content.toString('base64');
  const existingSha = await getSha(token, owner, repo, filePath);

  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(filePath)}`;
  const body = { message: `Update ${filePath}`, content: b64, ...(existingSha && { sha: existingSha }) };

  let r = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  // Retry on 409 SHA mismatch
  if (r.status === 409) {
    const err = await r.json().catch(() => ({}));
    const match = err.message?.match(/is at ([a-f0-9]+) but expected/);
    const freshSha = match ? match[1] : await getSha(token, owner, repo, filePath);
    if (freshSha) {
      r = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Accept': 'application/vnd.github+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ message: `Update ${filePath}`, content: b64, sha: freshSha }),
      });
    }
  }

  if (delayMs) await new Promise(res => setTimeout(res, delayMs));

  if (r.ok) {
    const data = await r.json();
    const isSame = data.content?.sha === existingSha;
    return { ok: true, f: filePath, isNew: !existingSha, isSame };
  }

  const err = await r.json().catch(() => ({ message: r.statusText }));
  return { ok: false, f: filePath, status: r.status, error: err.message };
}

async function quickSync({ token, owner, repo, delayMs = 50 }) {
  const files = await getChangedFiles();
  const newFiles = [];
  const updatedFiles = [];
  const unchangedFiles = [];
  const failedFiles = [];

  for (const f of files) {
    const result = await uploadFile(token, owner, repo, f, delayMs);
    if (result.ok) {
      if (result.isSame) unchangedFiles.push(f);
      else if (result.isNew) newFiles.push(f);
      else updatedFiles.push(f);
    } else {
      failedFiles.push(result);
    }
  }

  return {
    new: newFiles,
    updated: updatedFiles,
    unchanged: unchangedFiles,
    failed: failedFiles,
  };
}

module.exports = { quickSync, getChangedFiles, uploadFile, getSha };
