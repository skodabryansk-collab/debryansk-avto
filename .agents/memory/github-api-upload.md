---
name: GitHub Contents API sync
description: Safe file sync via the connected GitHub proxy when direct git push is unavailable.
---

Use the connected GitHub integration's `proxyFetch` for Contents API calls inside an impure sandbox function. Do not read a raw token from connection settings or install an SDK for this operation.

**Why:** The connection's settings no longer expose an access token; the proxy adds credentials server-side. Direct token handling is unnecessary.

**How to apply:** Upload only changed tracked and untracked files, compare GET content before PUT, include the current SHA on updates, retry a 409 once, space writes, and report failures. Skip files over 1MB. The relative API path starts with `/repos/`; do not pass a full URL.

Trim every filename returned by CodeExecution's `shellExec` before passing it to `readFile`. Its output can contain CRLF, leaving an invisible `\r` after `split("\n")` and causing a misleading not-found error.

**Why:** A sync failed before contacting GitHub because the first local filename carried a trailing carriage return.

**How to apply:** Parse command output with `split(/\r?\n/).map(path => path.trim()).filter(Boolean)` before reading files.

If sequential PUTs start returning Cloudflare HTML 403 while GET still succeeds, stop retrying and report partial sync; wait for the proxy cooldown.
