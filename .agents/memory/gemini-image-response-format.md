---
name: Gemini image response format via Timeweb AI Gateway
description: Gemini image models return generated images in message.images[], not message.content (null). Required for image-to-image via /chat/completions.
---

# Gemini image-to-image via Timeweb AI Gateway

## Rule
When calling `/v1/chat/completions` with a Gemini image model + image input, the generated image is in:
```
choices[0].message.images[0].image_url.url  → "data:image/jpeg;base64,..."
```
`message.content` is **null**. Parsing `content` yields nothing.

## Why
Timeweb proxies Gemini image models via litellm/Vertex AI. The Vertex AI response includes inline images in a non-standard `images` field that litellm passes through as-is, separate from the OpenAI `content` field.

## How to apply
- Use `/v1/chat/completions` (NOT `/v1/images/generations`) for image-to-image with Gemini models
- Send reference image as `image_url` with base64 data URI in messages content
- Parse response: `msg.images?.[0]?.image_url?.url` → strip `data:image/...;base64,` prefix → Buffer

## Do not generalize Gemini's transport to other image providers

Earlier gateway tests that failed on `/images/edits` are no longer a valid blanket restriction. Timeweb has added working image-edit adapters; use fresh gateway-specific evidence rather than assuming all image models use chat.

## Files API note
Timeweb Files API (`/v1/files`) uploads to Google Generative Language Files API.
The `file_id` is base64 of: `litellm_proxy:...;llm_output_file_id,https://generativelanguage.googleapis.com/v1beta/files/xxx;...`
Passing the Google URI as `image_url` to `/images/generations` returns 200 but model ignores image — not true image conditioning.
