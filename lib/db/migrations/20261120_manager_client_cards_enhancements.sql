BEGIN;

ALTER TABLE public.manager_client_cards
  ADD COLUMN IF NOT EXISTS client_gender text,
  ADD COLUMN IF NOT EXISTS desired_vehicle_undecided boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS commercial_brand text,
  ADD COLUMN IF NOT EXISTS commercial_model text,
  ADD COLUMN IF NOT EXISTS current_car_inventory_id integer REFERENCES public.cars(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_car_snapshot jsonb;

COMMIT;
