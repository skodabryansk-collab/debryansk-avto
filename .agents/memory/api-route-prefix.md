---
name: API route prefix pitfall
description: How to correctly write Express route paths when app.use mounts on /api; also esbuild externals for multer/nodemailer.
---

## Rule

When `app.ts` does `app.use("/api", router)`, all route handlers inside the router must use paths **without** the `/api` prefix.

**Wrong:** `router.post("/api/send-email", ...)`  
**Correct:** `router.post("/send-email", ...)`

**Why:** Express concatenates the mount path and the handler path. `/api` + `/api/send-email` → `/api/api/send-email`, which never matches incoming requests, causing 404.

## How to apply

Check every new route file before registering it. If the app mounts on `/api`, handlers go directly to e.g. `/send-email`, `/cars`, etc.

## esbuild externals

`multer` and `busboy` (multer's dependency) must be added to the `external` array in `build.mjs` alongside `nodemailer`, otherwise esbuild may fail to bundle them or the route silently won't load.

```js
external: [
  "nodemailer",
  "multer",
  "busboy",
  // ...
]
```
