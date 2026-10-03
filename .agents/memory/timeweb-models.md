---
name: Timeweb model identifiers
description: OpenAI model naming rules for the project's Timeweb AI Gateway.
---

The Timeweb OpenAI-compatible gateway expects provider-qualified model IDs, such as `openai/gpt-4.1`, `openai/gpt-5-mini`, and `openai/gpt-5.4-mini`. Bare IDs like `gpt-4.1` can return HTTP 404 even when the model exists.

**Why:** The gateway routes OpenAI models by provider namespace; a bare model name caused every query in a GEO run to fail.

**How to apply:** When the API base URL uses `api.timeweb.ai`, default to the `openai/` prefix. Keep unqualified names for direct OpenAI endpoints and preserve explicit model overrides.