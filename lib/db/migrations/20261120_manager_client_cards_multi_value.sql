BEGIN;

ALTER TABLE public.manager_client_cards
  ADD COLUMN IF NOT EXISTS needs jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS current_cars jsonb NOT NULL DEFAULT '[]'::jsonb;

UPDATE public.manager_client_cards
SET needs = CASE
  WHEN desired_vehicle_undecided THEN jsonb_build_array(jsonb_build_object(
    'brand', NULL,
    'model', NULL,
    'undecided', true,
    'budgetRange', budget_range
  ))
  WHEN desired_brand IS NOT NULL OR desired_model IS NOT NULL OR budget_range IS NOT NULL
    THEN jsonb_build_array(jsonb_build_object(
      'brand', desired_brand,
      'model', desired_model,
      'undecided', false,
      'budgetRange', budget_range
    ))
  ELSE '[]'::jsonb
END
WHERE needs = '[]'::jsonb;

UPDATE public.manager_client_cards
SET current_cars = jsonb_build_array(jsonb_build_object(
  'brand', current_car_brand,
  'model', current_car_model,
  'year', current_car_year,
  'mileage', current_car_mileage,
  'generation', current_car_generation,
  'bodyType', current_car_body_type,
  'ownersCount', current_car_owners_count,
  'inventoryId', current_car_inventory_id,
  'snapshot', current_car_snapshot,
  'tradeInPlan', trade_in_plan
))
WHERE current_cars = '[]'::jsonb
  AND (
    current_car IS NOT NULL OR current_car_brand IS NOT NULL OR current_car_model IS NOT NULL
    OR current_car_year IS NOT NULL OR current_car_mileage IS NOT NULL
    OR current_car_generation IS NOT NULL OR current_car_body_type IS NOT NULL
    OR current_car_owners_count IS NOT NULL OR current_car_inventory_id IS NOT NULL
    OR trade_in_plan IS NOT NULL
  );

COMMIT;
