# CM Expert stock integration

## Purpose

The integration reads one complete CM Expert Business stock snapshot. It never copies the raw global dealer feed into the public API.

## Current salons

| CM dealer ID | Salon | Mode | Initial state |
| --- | --- | --- | --- |
| `28263` | Tenet Plus | `catalog` | Enabled |
| `27398` | Jeland | `catalog` | Enabled |
| `20556` | Haval Pro | `catalog` | Enabled |
| `21937` | Haval City | `catalog` | Enabled |

In `catalog` mode, CM Business supplies vehicle identity, price, photos, model details, and in-stock state. An active CM catalog automatically supersedes a same-name XML feed. In `options_only` mode, the existing website catalog remains unchanged and CM contributes approved equipment only after an exact VIN match.

## Update schedule

The default is every 30 minutes, matching the existing vehicle catalog sync. The admin can change the CM snapshot interval to 30, 60, or 120 minutes. A manual run always starts a fresh global snapshot and does not wait for the next scheduled run. At startup the service takes an initial snapshot after the vehicle sync.

CM returns a global paginated feed, so all enabled salons share one scan. Pagination must reach a confirmed terminal page before stock reconciliation. On a failed, malformed, or truncated scan, the service records an error and preserves the last verified per-car data.

## Per-salon settings and status

`cm_stock_integrations` stores the stable CM dealer ID, website salon name, integration mode, enabled flag, most recent status, timestamps, safe error text, rows in stock, matched vehicles, vehicles with options, option count, and scan metrics.

`cm_stock_sync_settings` stores the shared scan interval. `cm_stock_sync_runs` and `cm_stock_sync_run_dealers` keep recent run summaries without persisting raw CM records or credentials.

The Admin page **Склад CM** shows connection configuration state (never credential values), per-salon status and match counts, the refresh interval, manual refresh, and recent run history. New salons can be registered there in either mode. Catalog mode takes over a same-name XML feed; options-only mode requires a website catalog with valid VINs.

## Equipment provenance

- Only the allowlisted affirmative CM flags and recognized option enums become equipment labels.
- `cm_verified_extras` stores the CM-derived overlay separately from the catalog's original `extras`.
- Public new-car cards and manager quotes use the verified CM overlay for `options_only` salons. They do not fall back to a trim name or generic catalog extras.
- Unknown values remain absent. An unmatched VIN is visible in the Admin counts and as a manager warning.
- Disabling an `options_only` integration clears that salon's stored CM overlay; it does not delete the website catalog row.

## Adding a salon

1. Confirm the numeric CM dealer ID against the CM cabinet.
2. Choose `catalog` to replace the whole inventory source, or `options_only` to enrich an existing catalog that carries VINs.
3. Add the CM ID and exact salon name under **Склад CM**.
4. Run a manual scan and inspect the CM stock count, matched-car count, and cars with options.
5. For `options_only`, resolve source/catalog VIN differences if the match count is zero before publishing options.
6. Add a new field to the strict option allowlist only after confirming its meaning in CM. Never infer options from model, modification, or trim.
