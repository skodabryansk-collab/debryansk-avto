---
name: auto-track-and-sync
description: Automatically tracks which files were modified during a work session, then quickly syncs only those changed files to GitHub via the Contents API. Use when the user asks to save changes to GitHub, push files, or sync the repo, or when the session ends with uncommitted changes.
---

# Auto Track & Sync

## Goal

Every time I modify files during a work session, automatically note them. When the user asks to sync with GitHub, upload **only** those changed files via the GitHub Contents API — fast, no full-repo scan.

## When to Use

- User says: «Обнови файлы на репозитории», «Запушь на GitHub», «Сохрани изменения», «Синхронизируй»
- End of a session with uncommitted changes
- After any destructive git operation that failed (git push blocked in main agent)

## Step 1: Detect Changed Files

Always run this at the start of a sync request, or whenever the user asks what changed:

```bash
git diff --name-only HEAD 2>/dev/null || git status --short
```

This gives the exact list of modified files since the last commit. Save it to a session variable.

**Alternative** (if HEAD doesn't exist, e.g., fresh repo):
```bash
git status --short
```

## Step 2: Determine New vs Updated

For each file, check if it exists on GitHub already:

```bash
# GET /repos/{owner}/{repo}/contents/{path}
# 200 = exists, 404 = new
```

Track two buckets:
- `newFiles` — files not on GitHub (404)
- `updatedFiles` — files already on GitHub with different SHA

## Step 3: Upload Changed Files Only

For each file, sequential upload with 50ms delay to avoid rate limits:

1. Read file content
2. Base64 encode
3. Get existing SHA (if file exists)
4. PUT to GitHub Contents API
5. If 409 (SHA mismatch), get fresh SHA and retry once

```javascript
async function uploadFile(path, content, token, owner, repo) {
  const b64 = Buffer.from(content).toString('base64');
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}`;
  
  // Get existing SHA
  const get = await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } });
  const existingSha = get.ok ? (await get.json()).sha : null;
  
  const body = { message: `Update ${path}`, content: b64, ...(existingSha && { sha: existingSha }) };
  let r = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  
  // Handle SHA mismatch
  if (r.status === 409) {
    const err = await r.json();
    const match = err.message?.match(/is at ([a-f0-9]+) but expected/);
    const freshSha = match ? match[1] : (await fetch(url, { headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json' } }).then(r => r.ok ? r.json().then(d => d.sha) : null));
    if (freshSha) {
      r = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bearer ${token}`, 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' }, body: JSON.stringify({ message: `Update ${path}`, content: b64, sha: freshSha }) });
    }
  }
  
  return r.ok;
}
```

## Step 4: Skip Rules

Do NOT upload:
- Files >1MB (GitHub API returns 413)
- Files that don't exist in the filesystem
- `.git/`, `.gitignore`, `node_modules/` (unless user explicitly asks)
- Unrelated binary files (use user's binary list from project)

## Critical API Details

- **Authentication**: Always use `Authorization: Bearer {token}`, NOT `Authorization: token {token}`
- **Accept header**: `application/vnd.github+json`
- **Rate limit**: 50ms delay between sequential uploads
- **Retry**: 1 automatic retry on 409 SHA mismatch
- **Token source**: `listConnections('github')` → `connections[0].settings.access_token`

## Expected Output

After sync, report:
- New files uploaded
- Updated files
- Unchanged files
- Failed uploads
- Skipped (size/binary)

## Full Workflow Example

```
1. User asks to "обнови файлы на репозитории"
2. Run `git diff --name-only HEAD` to get changed files
3. Filter: skip >1MB, skip missing
4. For each file, check if exists on GitHub
5. Upload sequentially with 50ms delay
6. Report results: new / updated / unchanged / failed
```

## Repo Info (Project-specific)

- **Owner**: `skodabryansk-collab`
- **Repo**: `debryansk-avto`
- **Connector**: `github` (already configured via Replit integrations)
- **Binary extensions**: `.webp`, `.png`, `.jpg`, `.jpeg`, `.svg`, `.pdf`, `.mp4`, `.ico`, `.woff`, `.woff2`, `.ttf`, `.otf`, `.eot`, `.gif`, `.bmp`, `.zip`, `.tar`, `.gz`, `.mp3`, `.wav`, `.avi`, `.mov`
