BEGIN;

ALTER TABLE public.brands
  ADD COLUMN IF NOT EXISTS onec_department_code text,
  ADD COLUMN IF NOT EXISTS onec_department_code_confirmed boolean NOT NULL DEFAULT false;

ALTER TABLE public.locations
  ADD COLUMN IF NOT EXISTS onec_organization_code text,
  ADD COLUMN IF NOT EXISTS onec_organization_code_confirmed boolean NOT NULL DEFAULT false;

-- These identifiers are local placeholders, not 1C catalog codes.
-- The feed refuses to export records until real codes are supplied and confirmed.
UPDATE public.brands
SET onec_department_code = 'TMP1C-DEPT-' || lpad(id::text, 4, '0')
WHERE onec_department_code IS NULL;

UPDATE public.locations
SET onec_organization_code = 'TMP1C-ORG-' || lpad(id::text, 4, '0')
WHERE onec_organization_code IS NULL;

COMMIT;
