---
name: Auto.ru Dealer API
description: How to call the Auto.ru dealer API for car catalog (brands/models). Covers host, auth format, and working endpoints.
---

# Auto.ru Dealer API

## Host
`https://apiauto.ru/1.0` (NOT api.auto.ru — that domain does not resolve)

## Auth
Header: `x-authorization: <token>`
- No "Bearer" prefix
- No "Vertis" prefix
- Just the raw token value

Token format: `bns0045-<hex string>` (Vertis token style)

## Working endpoints

### All brands
`GET /1.0/search/cars/breadcrumbs`
- Response: `{ breadcrumbs: [{ entities: [...brands] }] }`
- `breadcrumbs[0].entities` = array of 420 brands
- Each brand: `{ id, name, mark: { cyrillic_name }, is_popular }`
- Cache: 24 hours (brands are very stable)

### Models for a brand
`GET /1.0/search/cars/breadcrumbs?bc_lookup=TOYOTA`
- Response: `{ breadcrumbs: [{ entities: [...models] }, { entities: [...allBrands] }] }`
- `breadcrumbs[0].entities` = models for that brand
- Each model: `{ id, name }`
- Cache: 1 hour

## Notes
- `/1.0/reference/catalog/cars/mark` returns 404 — wrong endpoint
- `/1.0/dealer/account` requires dealer session_id (different auth flow, not needed for catalog)
- Replit dev environment cannot resolve `api.auto.ru` or `apiauto.ru` directly from browser,
  but shell/Node.js CAN reach `apiauto.ru` — so always proxy via backend
- Popular brands flag (`is_popular`) useful for grouping selects with `<optgroup>`

**Why:** Auto.ru DNS doesn't resolve from browser in Replit dev, but works from Node/shell.
Always keep the API key server-side and proxy through Express.
