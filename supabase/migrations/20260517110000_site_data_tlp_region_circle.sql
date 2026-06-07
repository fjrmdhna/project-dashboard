-- Circle grouping for TLP New Site (aligned with site_data_5g.region_circle)
ALTER TABLE public.site_data_tlp
  ADD COLUMN IF NOT EXISTS region_circle text;

COMMENT ON COLUMN public.site_data_tlp.region_circle IS
  'Regional circle label (e.g. JAVA, SUMATERA). Populated from region mapping or ingest.';

CREATE INDEX IF NOT EXISTS idx_site_data_tlp_region_circle
  ON public.site_data_tlp (region_circle)
  WHERE region_circle IS NOT NULL;

-- Backfill: dominant region_circle per region from site_data_5g
UPDATE public.site_data_tlp t
SET region_circle = m.region_circle
FROM (
  SELECT region,
         mode() WITHIN GROUP (ORDER BY upper(trim(region_circle))) AS region_circle
  FROM public.site_data_5g
  WHERE region IS NOT NULL
    AND region_circle IS NOT NULL
    AND trim(region) <> ''
    AND trim(region_circle) <> ''
  GROUP BY region
) m
WHERE t.region = m.region
  AND (t.region_circle IS NULL OR btrim(t.region_circle) = '');

-- Secondary backfill via site_id when available
UPDATE public.site_data_tlp t
SET region_circle = upper(btrim(g.region_circle))
FROM public.site_data_5g g
WHERE g.site_id IS NOT NULL
  AND t.site_id IS NOT NULL
  AND g.site_id = t.site_id
  AND g.region_circle IS NOT NULL
  AND btrim(g.region_circle) <> ''
  AND (t.region_circle IS NULL OR btrim(t.region_circle) = '');
