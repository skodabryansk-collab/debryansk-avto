BEGIN;

ALTER TABLE public.manager_client_cards
  ADD COLUMN IF NOT EXISTS onec_sync_pending boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.manager_client_card_onec_worksheets (
  id serial PRIMARY KEY,
  card_id integer NOT NULL REFERENCES public.manager_client_cards(id) ON DELETE CASCADE,
  source_key text NOT NULL,
  organization_code text NOT NULL,
  department_code text NOT NULL,
  brand_names jsonb NOT NULL DEFAULT '[]'::jsonb,
  content_hash text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  onec_dealer_manager text,
  onec_worksheet_status text,
  onec_archive_reason text,
  onec_updated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT manager_client_card_onec_worksheets_action_codes_ck
    CHECK (length(trim(organization_code)) > 0 AND length(trim(department_code)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS manager_client_card_onec_worksheets_source_key_uidx
  ON public.manager_client_card_onec_worksheets (source_key);
CREATE UNIQUE INDEX IF NOT EXISTS manager_client_card_onec_worksheets_division_uidx
  ON public.manager_client_card_onec_worksheets (card_id, organization_code, department_code);
CREATE INDEX IF NOT EXISTS manager_client_card_onec_worksheets_active_id_idx
  ON public.manager_client_card_onec_worksheets (is_active, id);
CREATE INDEX IF NOT EXISTS manager_client_card_onec_worksheets_card_active_idx
  ON public.manager_client_card_onec_worksheets (card_id, is_active);

CREATE TABLE IF NOT EXISTS public.manager_client_card_onec_changes (
  id serial PRIMARY KEY,
  worksheet_id integer NOT NULL
    REFERENCES public.manager_client_card_onec_worksheets(id) ON DELETE CASCADE,
  action text NOT NULL CHECK (action IN ('upsert', 'delete')),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manager_client_card_onec_changes_worksheet_idx
  ON public.manager_client_card_onec_changes (worksheet_id, id);

WITH card_needs AS (
  SELECT
    card.id AS card_id,
    CASE
      WHEN jsonb_typeof(card.needs) = 'array' AND jsonb_array_length(card.needs) > 0
        THEN card.needs
      WHEN card.desired_brand IS NOT NULL OR card.desired_model IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object(
          'brand', card.desired_brand,
          'model', card.desired_model,
          'undecided', card.desired_vehicle_undecided,
          'budgetRange', card.budget_range,
          'plannedPurchaseDate', NULL
        ))
      ELSE '[]'::jsonb
    END AS needs
  FROM public.manager_client_cards AS card
),
target_brands AS (
  SELECT DISTINCT card_id, trim(need->>'brand') AS brand_name
  FROM card_needs
  CROSS JOIN LATERAL jsonb_array_elements(needs) AS need
  WHERE nullif(trim(need->>'brand'), '') IS NOT NULL
  UNION
  SELECT id AS card_id, trim(commercial_brand) AS brand_name
  FROM public.manager_client_cards
  WHERE nullif(trim(commercial_brand), '') IS NOT NULL
),
brand_mapping_counts AS (
  SELECT
    target.card_id,
    target.brand_name,
    count(DISTINCT location.id) AS location_count,
    count(DISTINCT CASE
      WHEN nullif(trim(location.onec_organization_code), '') IS NOT NULL
       AND location.onec_organization_code_confirmed
       AND nullif(trim(brand.onec_department_code), '') IS NOT NULL
       AND brand.onec_department_code_confirmed
       AND location.onec_organization_code NOT LIKE 'TMP1C-%'
       AND brand.onec_department_code NOT LIKE 'TMP1C-%'
      THEN location.onec_organization_code || chr(31) || brand.onec_department_code
    END) AS confirmed_mapping_count
  FROM target_brands AS target
  LEFT JOIN public.brands AS brand
    ON lower(trim(brand.name)) = lower(trim(target.brand_name))
  LEFT JOIN public.location_brands AS location_brand
    ON location_brand.brand_id = brand.id
  LEFT JOIN public.locations AS location
    ON location.id = location_brand.location_id
  GROUP BY target.card_id, target.brand_name
),
pending_cards AS (
  SELECT DISTINCT card_id
  FROM brand_mapping_counts
  WHERE location_count <> 1 OR confirmed_mapping_count <> 1
)
UPDATE public.manager_client_cards AS card
SET onec_sync_pending = EXISTS (
  SELECT 1 FROM pending_cards WHERE pending_cards.card_id = card.id
);

WITH card_needs AS (
  SELECT
    card.id AS card_id,
    card.onec_dealer_manager,
    card.onec_worksheet_status,
    card.onec_archive_reason,
    card.onec_updated_at,
    CASE
      WHEN jsonb_typeof(card.needs) = 'array' AND jsonb_array_length(card.needs) > 0
        THEN card.needs
      WHEN card.desired_brand IS NOT NULL OR card.desired_model IS NOT NULL
        THEN jsonb_build_array(jsonb_build_object(
          'brand', card.desired_brand,
          'model', card.desired_model,
          'undecided', card.desired_vehicle_undecided,
          'budgetRange', card.budget_range,
          'plannedPurchaseDate', NULL
        ))
      ELSE '[]'::jsonb
    END AS needs
  FROM public.manager_client_cards AS card
),
target_brands AS (
  SELECT DISTINCT
    card_needs.card_id,
    card_needs.onec_dealer_manager,
    card_needs.onec_worksheet_status,
    card_needs.onec_archive_reason,
    card_needs.onec_updated_at,
    trim(need->>'brand') AS brand_name
  FROM card_needs
  CROSS JOIN LATERAL jsonb_array_elements(card_needs.needs) AS need
  WHERE nullif(trim(need->>'brand'), '') IS NOT NULL
  UNION
  SELECT
    card.id,
    card.onec_dealer_manager,
    card.onec_worksheet_status,
    card.onec_archive_reason,
    card.onec_updated_at,
    trim(card.commercial_brand)
  FROM public.manager_client_cards AS card
  WHERE nullif(trim(card.commercial_brand), '') IS NOT NULL
),
resolved AS (
  SELECT
    target.card_id,
    target.onec_dealer_manager,
    target.onec_worksheet_status,
    target.onec_archive_reason,
    target.onec_updated_at,
    brand.name AS canonical_brand_name,
    location.onec_organization_code AS organization_code,
    brand.onec_department_code AS department_code
  FROM target_brands AS target
  JOIN public.brands AS brand
    ON lower(trim(brand.name)) = lower(trim(target.brand_name))
  JOIN public.location_brands AS location_brand
    ON location_brand.brand_id = brand.id
  JOIN public.locations AS location
    ON location.id = location_brand.location_id
  WHERE location.onec_organization_code_confirmed
    AND brand.onec_department_code_confirmed
    AND nullif(trim(location.onec_organization_code), '') IS NOT NULL
    AND nullif(trim(brand.onec_department_code), '') IS NOT NULL
    AND location.onec_organization_code NOT LIKE 'TMP1C-%'
    AND brand.onec_department_code NOT LIKE 'TMP1C-%'
),
division_groups AS (
  SELECT
    card_id,
    organization_code,
    department_code,
    jsonb_agg(DISTINCT canonical_brand_name ORDER BY canonical_brand_name) AS brand_names,
    max(onec_dealer_manager) AS onec_dealer_manager,
    max(onec_worksheet_status) AS onec_worksheet_status,
    max(onec_archive_reason) AS onec_archive_reason,
    max(onec_updated_at) AS onec_updated_at
  FROM resolved
  GROUP BY card_id, organization_code, department_code
)
INSERT INTO public.manager_client_card_onec_worksheets (
  card_id,
  source_key,
  organization_code,
  department_code,
  brand_names,
  onec_dealer_manager,
  onec_worksheet_status,
  onec_archive_reason,
  onec_updated_at
)
SELECT
  card_id,
  card_id::text || ':division:' || encode(
    convert_to(organization_code || chr(31) || department_code, 'UTF8'),
    'hex'
  ),
  organization_code,
  department_code,
  brand_names,
  onec_dealer_manager,
  onec_worksheet_status,
  onec_archive_reason,
  onec_updated_at
FROM division_groups
ON CONFLICT (card_id, organization_code, department_code)
DO UPDATE SET
  brand_names = EXCLUDED.brand_names,
  is_active = true,
  updated_at = now();

COMMIT;
