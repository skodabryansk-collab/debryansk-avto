---
name: SEO suggestion schema drift
description: Raw SQL in the SEO admin route can expose missing columns when dev and VPS schemas drift.
---

The SEO suggestion table is read with raw SQL, so every selected or written column must have an idempotent startup migration; development and VPS schemas can otherwise diverge and turn the admin list into a 500.

**Why:** Production had a column that the development database lacked, masking the issue until the endpoint was tested locally.

**How to apply:** When adding a raw SQL field to SEO suggestions, add its `ADD COLUMN IF NOT EXISTS` migration in the same change and verify the admin list in both environments.