---
name: API source ESM test runtime
description: Direct tsx integration tests exercise API source modules without the esbuild runtime banner.
---

Source-level API integration tests run under native ESM, not the bundled server runtime.

**Why:** The production bundle supplies `__dirname` and `require` globals through its esbuild banner; direct `tsx` tests do not, so source modules must use `import.meta.url` and static ESM imports.

**How to apply:** When adding an HTTP integration test that imports an API router directly, avoid bundle-only globals and mount only the target router if unrelated application middleware has incompatible startup dependencies.