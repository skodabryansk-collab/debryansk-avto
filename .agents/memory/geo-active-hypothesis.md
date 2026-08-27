---
name: GEO active hypothesis ownership
description: Правило определения активной SEO/GEO-гипотезы при дедупликации рекомендаций.
---

Активными для блокировки новой GEO-гипотезы считаются `pending`, `manual` и `applied` только при наличии `evaluate_at` и отсутствии `evaluated_at`. Старые `applied`-строки без расписания оценки — это legacy-история, а не вечный lock страницы.

**Why:** В production исторические `meta`-рекомендации могли иметь `status='applied'`, но пустые поля оценки. Если трактовать любой такой ряд как активный, GEO никогда не создаст рекомендацию для этой страницы.

**How to apply:** В GEO-дедупликации учитывай `evaluate_at IS NOT NULL AND evaluated_at IS NULL` для ожидающих оценки applied-записей; не меняй SEO- и GEO-поля местами.