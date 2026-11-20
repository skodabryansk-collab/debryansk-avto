BEGIN;

CREATE TABLE IF NOT EXISTS public.manager_client_cards (
  id serial PRIMARY KEY,
  manager_id integer NOT NULL REFERENCES public.managers(id) ON DELETE RESTRICT,
  client_name text NOT NULL,
  client_phone text NOT NULL,
  desired_brand text,
  desired_model text,
  budget_range text,
  current_car text,
  current_car_year integer,
  trade_in_plan text,
  commercial_car_id integer REFERENCES public.cars(id) ON DELETE SET NULL,
  commercial_car_snapshot jsonb,
  payment_method text,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manager_client_cards_current_car_year_check
    CHECK (current_car_year IS NULL OR current_car_year BETWEEN 1950 AND 2100)
);

CREATE INDEX IF NOT EXISTS manager_client_cards_manager_created_idx
  ON public.manager_client_cards (manager_id, created_at DESC);

CREATE INDEX IF NOT EXISTS manager_client_cards_phone_idx
  ON public.manager_client_cards (client_phone);

COMMIT;
