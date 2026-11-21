BEGIN;

ALTER TABLE public.manager_client_cards
  ADD COLUMN IF NOT EXISTS onec_dealer_manager text,
  ADD COLUMN IF NOT EXISTS onec_worksheet_status text,
  ADD COLUMN IF NOT EXISTS onec_updated_at timestamptz;

COMMIT;
