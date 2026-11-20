BEGIN;

CREATE TABLE IF NOT EXISTS public.customer_surveys (
  id serial PRIMARY KEY,
  title text NOT NULL,
  slug text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  definition jsonb NOT NULL,
  version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_surveys_slug_unique
  ON public.customer_surveys (slug);

CREATE TABLE IF NOT EXISTS public.customer_survey_responses (
  id serial PRIMARY KEY,
  survey_id integer NOT NULL,
  survey_version integer NOT NULL,
  submission_id text NOT NULL,
  payload_hash text NOT NULL,
  answers jsonb NOT NULL,
  definition_snapshot jsonb NOT NULL,
  source text,
  lead_id integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS customer_survey_responses_submission_unique
  ON public.customer_survey_responses (survey_id, submission_id);

CREATE INDEX IF NOT EXISTS customer_survey_responses_survey_created_idx
  ON public.customer_survey_responses (survey_id, created_at);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_survey_responses_survey_id_customer_surveys_id_fk'
      AND conrelid = 'public.customer_survey_responses'::regclass
  ) THEN
    ALTER TABLE public.customer_survey_responses
      ADD CONSTRAINT customer_survey_responses_survey_id_customer_surveys_id_fk
      FOREIGN KEY (survey_id) REFERENCES public.customer_surveys(id) ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'customer_survey_responses_lead_id_leads_id_fk'
      AND conrelid = 'public.customer_survey_responses'::regclass
  ) THEN
    ALTER TABLE public.customer_survey_responses
      ADD CONSTRAINT customer_survey_responses_lead_id_leads_id_fk
      FOREIGN KEY (lead_id) REFERENCES public.leads(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
