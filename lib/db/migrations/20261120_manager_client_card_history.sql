BEGIN;

ALTER TABLE public.manager_client_cards
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

UPDATE public.manager_client_cards
SET updated_at = created_at
WHERE updated_at IS NULL;

ALTER TABLE public.manager_client_cards
  ALTER COLUMN updated_at SET DEFAULT now(),
  ALTER COLUMN updated_at SET NOT NULL;

CREATE TABLE IF NOT EXISTS public.manager_client_card_history (
  id serial PRIMARY KEY,
  card_id integer NOT NULL REFERENCES public.manager_client_cards(id) ON DELETE CASCADE,
  editor_manager_id integer REFERENCES public.managers(id) ON DELETE SET NULL,
  editor_name text NOT NULL,
  editor_role text NOT NULL CHECK (editor_role IN ('manager', 'admin')),
  changes jsonb NOT NULL,
  previous_brands jsonb NOT NULL DEFAULT '[]'::jsonb,
  current_brands jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS manager_client_card_history_card_idx
  ON public.manager_client_card_history (card_id, id DESC);

COMMIT;
