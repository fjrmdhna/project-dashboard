-- Derived year from wo_number_1 suffix (e.g. .../25 → 2025) for fast TLP New Site filters.
CREATE OR REPLACE FUNCTION public.tlp_parse_year_from_wo_number(wo text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN wo IS NULL OR btrim(wo) = '' THEN NULL
    ELSE (
      WITH suffix AS (
        SELECT (regexp_match(btrim(wo), '/([^/]+)$'))[1] AS s
      )
      SELECT CASE
        WHEN s ~ '^\d{2}$' THEN 2000 + s::integer
        WHEN s ~ '^\d{4}$' AND s::integer BETWEEN 1900 AND 2100 THEN s::integer
        ELSE NULL
      END
      FROM suffix
    )
  END
$$;

ALTER TABLE public.site_data_tlp
  ADD COLUMN IF NOT EXISTS year_from_wo integer
  GENERATED ALWAYS AS (public.tlp_parse_year_from_wo_number(wo_number_1)) STORED;

CREATE INDEX IF NOT EXISTS idx_site_data_tlp_year_from_wo
  ON public.site_data_tlp (year_from_wo)
  WHERE year_from_wo IS NOT NULL;
