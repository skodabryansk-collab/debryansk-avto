BEGIN;

CREATE TABLE IF NOT EXISTS public.onec_exchange_logs (
  id serial PRIMARY KEY,
  event_type text NOT NULL,
  endpoint text,
  method text NOT NULL,
  http_status integer,
  outcome text NOT NULL,
  after_id integer,
  next_cursor integer,
  item_count integer NOT NULL DEFAULT 0,
  has_more boolean,
  duration_ms integer,
  error_code text,
  request_id text,
  entity_type text,
  entity_id integer,
  entity_name text,
  previous_code text,
  new_code text,
  actor_login text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS onec_exchange_logs_created_at_idx
  ON public.onec_exchange_logs (created_at);

CREATE INDEX IF NOT EXISTS onec_exchange_logs_event_created_at_idx
  ON public.onec_exchange_logs (event_type, created_at);

COMMIT;
