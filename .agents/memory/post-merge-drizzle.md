---
name: Non-interactive post-merge schema sync
description: Safe development schema updates in the non-interactive post-merge setup.
---

Do not use an unfiltered Drizzle `push-force` for this project. The live schema contains raw-SQL-managed tables and columns that are absent from the Drizzle definitions; a broad force push can remove data. For new feature tables, use an additive, idempotent SQL migration run by the post-merge script against the development database.

**Why:** A schema push proposed deleting populated columns and unrelated indexes, and the non-interactive `--force` path would have applied destructive changes.

**How to apply:** Keep feature migrations additive and idempotent; run them from `scripts/post-merge.sh` against development only. Production schema changes remain governed by Replit Publish.