---
name: Safe post-merge schema updates
description: Safe additive database migrations for development and the VPS production database.
---

Do not use an unfiltered Drizzle `push-force` for this project. The live schema contains raw-SQL-managed tables and columns that are absent from the Drizzle definitions; a broad force push can remove data. Development changes use additive, idempotent SQL migrations run by the post-merge script. The published application uses a separate PostgreSQL database on the VPS, so production schema changes must be applied explicitly to that database with the same targeted migration.

**Why:** A schema push proposed deleting populated columns and unrelated indexes, and the non-interactive `--force` path would have applied destructive changes.

**How to apply:** Keep feature migrations additive and idempotent. Run them through `scripts/post-merge.sh` for development; for production, confirm the VPS database target and apply the same migration before deploying code that uses the new columns.