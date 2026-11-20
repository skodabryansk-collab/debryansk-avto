---
name: 1C work-sheet feed
description: Mapping and safety rules for sending manager client worksheets to 1C.
---

For the 1C lead feed, the dealership location is the organization and the selected vehicle brand is the department. Resolve that relationship from the project's existing brand-to-location assignments. A brand must resolve to exactly one location before export.

Generated `TMP1C-` values are placeholders only. Do not send them to 1C, even if someone accidentally marks them confirmed. Export is blocked until the official organization and department codes replace them. The initial cursor is for skipping historical worksheets during first-time setup; after that, 1C must persist each returned cursor only after successful import.

Do not expose `current_car_inventory_id` or `current_cars[].inventory_id` in manager/1C API contracts. The selected commercial car may use an internal numeric database ID inside the admin app, but the 1C contract identifies it by `commercial_car_vin` (nullable when the VIN is unavailable). Each need may also carry an optional planned purchase date as a date-only `YYYY-MM-DD` string.

**Why:** the user specified that location represents organization, brand represents department, and official 1C codes will be supplied later. Placeholder values must not create incorrectly routed leads.

**Why:** the user confirmed there is no current-car inventory identifier in their workflow and wants the VIN—not an internal car row ID—sent for a selected commercial offer.

**How to apply:** keep one-time cursor initialization separate from polling, use the dedicated bearer token in the Authorization header, stop the feed on an unresolved brand, location, or official code, and keep internal car IDs out of the external payload.
