-- Add missing TLP New Site export columns aligned with Excel header row.

ALTER TABLE public.site_data_tlp
  ADD COLUMN IF NOT EXISTS program_group text,
  ADD COLUMN IF NOT EXISTS ran_vendor text,
  ADD COLUMN IF NOT EXISTS return_replacement_status text;

COMMENT ON COLUMN public.site_data_tlp.program_group IS
  'Program grouping label from TLP export (parent grouping above program_name).';

COMMENT ON COLUMN public.site_data_tlp.ran_vendor IS
  'RAN equipment vendor responsible for the site (distinct from twr_owner / tower vendor).';

COMMENT ON COLUMN public.site_data_tlp.return_replacement_status IS
  'Return or replacement workflow status for proposed-return / return sites.';
