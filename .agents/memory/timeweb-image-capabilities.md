---
name: Timeweb image capability verification
description: Gateway catalogue gaps, native reference formats and avoiding false image-to-image success.
---

Do not infer operational image capabilities solely from Timeweb's model catalogue. The gateway `/models` response omits working FLUX and Runway routes; Cloud catalogue `is_deprecated` does not mean that the route is stopped.

**Why:** Live probes found working models absent from the gateway list and deprecated Runway models that still generated images.

**How to apply:** Verify the provider-specific request protocol and inspect the generated image, not merely HTTP 200. Runway passes `referenceImages` through the image-generation endpoint; Seedream rejects reference `tag` fields and Lite requires roughly 4 MP. Gen-4 Turbo requires a reference. Do not silently retry failed reference editing as text-only generation: that creates a falsely successful result that ignores the user's photo.
