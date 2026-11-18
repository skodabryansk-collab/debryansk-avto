---
name: Price-tag data enrichment
description: Source-of-truth and fallback rules for enriching vehicle data used on printed tags.
---

For printed vehicle tags, the active cars database is the primary source for the selected vehicle. The specification database is supplemental: use it only to fill fields missing from the active vehicle record, and do not overwrite values that are already present there.

**Why:** The user clarified that this database exists to enrich vehicle data for price-tag printing, not to replace the active vehicle database.

**How to apply:** Start tag generation from the selected active vehicle. Match supplemental specifications to its verified model, trim, and configuration, then merge only missing values needed for a complete tag.
