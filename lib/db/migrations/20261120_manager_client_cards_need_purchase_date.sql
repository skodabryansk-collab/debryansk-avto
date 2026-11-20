BEGIN;

UPDATE manager_client_cards AS cards
SET needs = (
  SELECT COALESCE(
    jsonb_agg(
      CASE
        WHEN jsonb_typeof(need.value) = 'object' THEN
          jsonb_set(
            need.value,
            '{plannedPurchaseDate}',
            COALESCE(need.value->'plannedPurchaseDate', 'null'::jsonb),
            true
          )
        ELSE need.value
      END
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements(cards.needs) AS need(value)
)
WHERE jsonb_typeof(cards.needs) = 'array'
  AND EXISTS (
    SELECT 1
    FROM jsonb_array_elements(cards.needs) AS need(value)
    WHERE jsonb_typeof(need.value) = 'object'
      AND NOT (need.value ? 'plannedPurchaseDate')
  );

COMMIT;
