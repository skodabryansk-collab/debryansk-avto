---
name: GitHub auto-sync policy
description: Rule to always sync changes to GitHub after completing any task that modifies files.
---

# GitHub Auto-Sync Policy

## The Rule
After completing **any task that modifies files**, always run a GitHub sync before marking the task complete. Do not wait for the user to ask.

**Why:** The user's GitHub repo (`skodabryansk-collab/debryansk-avto`) is their backup and collaboration copy. They expect it to stay in sync automatically. The skill is called "auto-track-and-sync" but was previously only run on explicit request — the user found this confusing and wants it to be truly automatic.

## How to Apply
1. After making all code changes and verifying they work
2. Run the sync using the `auto-track-and-sync` skill (read `.agents/skills/auto-track-and-sync/SKILL.md`)
3. The skill uses `git diff --name-only HEAD` to find changed files, then uploads via GitHub Contents API
4. Report results briefly (N updated, N created) in the final message

## When to Skip
- Tasks that only read files (no modifications)
- Pure analysis/debugging with no file writes
- When the user explicitly says "don't push to GitHub"

## Repo Info
- Owner: `skodabryansk-collab`
- Repo: `debryansk-avto`
- Connector: `github` (Replit integration, already configured)
