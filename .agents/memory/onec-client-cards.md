---
name: 1C work-sheet feed
description: Mapping and safety rules for sending manager client worksheets to 1C.
---

For the 1C lead feed, the dealership location is the organization and the selected vehicle brand is the department. Resolve that relationship from the project's existing brand-to-location assignments. A brand must resolve to exactly one location before export.

Generated `TMP1C-` values are placeholders only. Do not send them to 1C, even if someone accidentally marks them confirmed. Export is blocked until the official organization and department codes replace them. The initial cursor is for skipping historical worksheets during first-time setup; after that, 1C must persist each returned cursor only after successful import.

Do not expose `current_car_inventory_id` or `current_cars[].inventory_id` in manager/1C API contracts. The selected commercial car may use an internal numeric database ID inside the admin app, but the 1C contract identifies it by `commercial_car_vin` (nullable when the VIN is unavailable). Each need may also carry an optional planned purchase date as a date-only `YYYY-MM-DD` string.

The 1C payload should send organization and department codes, not their display names, and should not expose an internal `brand_id`. Keep `source_key` as an opaque idempotency key built from the worksheet ID and normalized brand name.

**Why:** the user specified that location represents organization, brand represents department, and official 1C codes will be supplied later. Placeholder values must not create incorrectly routed leads.

**Why:** the user confirmed there is no current-car inventory identifier in their workflow and wants the VIN—not an internal car row ID—sent for a selected commercial offer.

**Why:** the user clarified that 1C needs the organization/department codes and brand name, but not display names or the source database's brand ID.

**How to apply:** keep one-time cursor initialization separate from polling, use the dedicated bearer token in the Authorization header, stop the feed on an unresolved brand, location, or official code, keep internal IDs out of external fields, and send codes rather than display names.

## 1C worksheet statuses

The exact status values sent by 1C are `Создан`, `В работе`, `Проверка перед закрытием`, `Архив`, and `Завершен`. They mean, respectively: received but not yet taken by a manager; being handled by a manager; under review before archiving; declined purchase; successful sale. When sending `Архив`, include a non-empty `archive_reason` in the same update.

**Why:** the user defined these as the dealership's workflow states and requires the refusal reason to accompany archived worksheets.

**How to apply:** preserve the exact Russian status values across API validation, integration docs, and admin display; do not substitute free-form 1C status labels.

## Official department codes supplied by the user

| 1C brand label | Production brand row | Department code |
|---|---|---|
| Авто с пробегом | С пробегом | `ЦБ000008` |
| Омода Брянск | OMODA | `ЦБ000009` |
| Тенет Брянск | Tenet | `ЦБ000010` |
| Джетур Брянск | JETOUR | `ЦБ000012` |
| SOUEAST | SOUEAST | `ЦБ000012` |
| Джейку Брянск | JAECOO | `ЦБ000013` |
| Jeland | Jeland | `ЦБ000013` |
| Хавейл Про Брянск | Haval Pro | `ЦБ000014` |
| Хавейл Сити Брянск | Haval City | `ЦБ000015` |
| Тенет Плюс Брянск | Tenet Plus | `ЦБ000018` |

**Why:** the user supplied these authoritative codes and asked to use them for production 1C routing.

**How to apply:** preserve the Cyrillic `ЦБ` prefix exactly; never infer codes for other departments or organization-to-location assignments.

## Official organization codes supplied by the user

| Production location | Organization label | Organization code |
|---|---|---|
| Литейная | Дебрянск Авто | `00001` |
| Советская | Дебрянск Авто | `00001` |
| Супонево | БНМ-1 | `ЦБ000005` |
| Московский | МБ Брянск | `ЦБ000004` |

**Why:** the user confirmed this exact assignment after production showed four locations but the supplied organization list had three codes.

**How to apply:** the same organization code may correctly serve more than one production location; preserve leading zeros and the Cyrillic prefix exactly.

The production brand `С пробегом` is assigned to the `Супонево` location (location id 3) in the shared public `location_brands` directory. Its department code is `ЦБ000008`, and the location's organization code is `ЦБ000005`.

**Why:** the user explicitly chose to make the used-car brand-to-location relationship visible on the public site as well as available to 1C routing.

**How to apply:** keep this assignment in sync when reviewing public location listings and 1C organization routing; the brand must resolve to exactly one location.
