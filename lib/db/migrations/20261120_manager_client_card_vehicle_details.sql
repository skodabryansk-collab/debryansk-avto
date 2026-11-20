BEGIN;

ALTER TABLE public.manager_client_cards
  ADD COLUMN IF NOT EXISTS current_car_brand text,
  ADD COLUMN IF NOT EXISTS current_car_model text,
  ADD COLUMN IF NOT EXISTS current_car_mileage integer,
  ADD COLUMN IF NOT EXISTS current_car_generation text,
  ADD COLUMN IF NOT EXISTS current_car_body_type text,
  ADD COLUMN IF NOT EXISTS current_car_owners_count text;

COMMIT;
