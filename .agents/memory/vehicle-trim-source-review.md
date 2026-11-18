---
name: Vehicle trim source review
description: Reliable extraction of model trim names from manufacturer price-list PDFs.
---

For vehicle-spec PDFs, do not conclude that a trim name is absent based only on extracted text. Inspect every page, especially later-page equipment matrices, and transcribe the exact trim labels. Keep separate trims separate; store Russian and English aliases as aliases, not as one trim. Preserve production-year, powertrain, and drivetrain variants.

**Why:** Manufacturer PDFs can encode table headings as positioned text, vector shapes, or images. Text extraction previously omitted visible Haval trim columns and split a Jetour trim name across lines.

**How to apply:** Compare each source PDF's complete trim matrix with the normalized table before reporting missing names or generating import rows. Deduplicate exact duplicate PDFs, but review distinct price-list versions independently.
