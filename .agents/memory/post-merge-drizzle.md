---
name: Non-interactive post-merge schema sync
description: Post-merge setup runs without a TTY, so Drizzle schema pushes must use the package's non-interactive force command.
---

The post-merge environment has stdin closed and cannot answer Drizzle Kit prompts. Schema synchronization must use the repository's non-interactive `push-force` entry point.

**Why:** A normal `drizzle-kit push` can pause on a data-loss confirmation and cause the post-merge job to time out even when the database change is safe.

**How to apply:** Keep post-merge setup idempotent and verify potentially destructive schema suggestions against existing development data before changing the script. Production schema changes remain governed by the publish flow.