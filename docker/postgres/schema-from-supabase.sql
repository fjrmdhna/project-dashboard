-- Auto-generated schema from Supabase public tables
BEGIN;

CREATE OR REPLACE FUNCTION public.tlp_parse_year_from_wo_number(wo text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_site_data_aop_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.update_site_data_tlp_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$function$;


DROP TABLE IF EXISTS public."aop_filter_templates" CASCADE;
CREATE TABLE public."aop_filter_templates" (
  "id" uuid DEFAULT gen_random_uuid() NOT NULL,
  "name" text NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS public."site_data" CASCADE;
CREATE TABLE public."site_data" (
  "id" integer NOT NULL,
  "site_id" text NULL,
  "site_name" text NULL,
  "mc_cluster" text NULL,
  "dati_ii" text NULL,
  "scope_of_work" text NULL,
  "ran_scope" text NULL,
  "latitude" double precision NULL,
  "longitude" double precision NULL,
  "nano_cluster" text NULL,
  "survey_ff" timestamp NULL,
  "survey_bf" timestamp NULL,
  "survey_af" timestamp NULL,
  "mos_ff" timestamp NULL,
  "mos_bf" timestamp NULL,
  "mos_af" timestamp NULL,
  "cutover_ff" timestamp NULL,
  "cutover_bf" timestamp NULL,
  "cutover_af" timestamp NULL,
  "site_dismantle_ff" timestamp NULL,
  "site_dismantle_bf" timestamp NULL,
  "site_dismantle_af" timestamp NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "system_key" text NOT NULL,
  "cx_approved" timestamp NULL,
  "site_status" text NULL,
  "hotnews_af" timestamp NULL,
  "sales_area" text NULL,
  "year" text NULL,
  "swap_weekly_plan" text NULL,
  "swap_monthly_plan" text NULL,
  "swap_time_sec1_ff" text NULL,
  "swap_time_sec2_ff" text NULL,
  "swap_time_sec3_ff" text NULL,
  "swap_time_sec1_af" text NULL,
  "swap_time_sec2_af" text NULL,
  "swap_time_sec3_af" text NULL,
  "area" text NULL,
  "rfs_af" timestamp NULL,
  "ready_for_acpt_date" timestamp NULL,
  "rfc_submitted" timestamp NULL,
  "rfc_approved" timestamp NULL,
  "endorse_af" timestamp NULL,
  "pac_accepted_af" timestamp NULL,
  "cluster_acceptance_af" timestamp NULL,
  "fac_af" timestamp NULL,
  "site_blocking" text NULL,
  "scope_strategy" text NULL,
  "wbs_status" text NULL,
  "mocn_activation_forecast" timestamp NULL,
  "hybrid_optimization_af" timestamp NULL,
  "site_program" text NULL,
  "remarks" text NULL,
  "5g_activation_date" timestamp NULL,
  "5g_readiness_date" timestamp NULL,
  "patp_accepted_af" timestamp NULL,
  PRIMARY KEY ("system_key")
);

DROP TABLE IF EXISTS public."site_data_5g" CASCADE;
CREATE TABLE public."site_data_5g" (
  "system_key" text NOT NULL,
  "SBOQ.project_type" text NULL,
  "vendor_code" text NULL,
  "vendor_name" text NULL,
  "wbs_status" text NULL,
  "site_id" text NULL,
  "site_name" text NULL,
  "new_site_id" text NULL,
  "new_site_name" text NULL,
  "unique_id" text NULL,
  "relo_id" text NULL,
  "relo_name" text NULL,
  "site_category" text NULL,
  "po_number" text NULL,
  "po_subline" text NULL,
  "network_header" text NULL,
  "year" text NULL,
  "program_name" text NULL,
  "project_name" text NULL,
  "program" text NULL,
  "program_report" text NULL,
  "ran_score" text NULL,
  "region" text NULL,
  "region_wise" text NULL,
  "region_circle" text NULL,
  "nano_cluster" text NULL,
  "twr_owner" text NULL,
  "long" double precision NULL,
  "lat" double precision NULL,
  "scope_of_work" text NULL,
  "issue_category" text NULL,
  "site_status" text NULL,
  "highlevel_issue" text NULL,
  "ran_scope" text NULL,
  "scope_category" text NULL,
  "imp_ttp" text NULL,
  "mc_cluster" text NULL,
  "imp_integ_ff" timestamp NULL,
  "imp_integ_af" timestamp NULL,
  "rfs_ff" timestamp NULL,
  "rfs_af" timestamp NULL,
  "rfc_approved" timestamp NULL,
  "hotnews_af" timestamp NULL,
  "endorse_af" timestamp NULL,
  "pac_accepted_af" timestamp NULL,
  "5g_readiness_date" timestamp NULL,
  "5g_activation_date" timestamp NULL,
  "cx_submitted" timestamp NULL,
  "cx_approved" timestamp NULL,
  "cx_acceptance_status" text NULL,
  "cx_remark" text NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "RF_Fusion.cutover_af" timestamp NULL,
  "rfs_bf" timestamp NULL,
  "mocn_activation_forecast" timestamp NULL,
  "rfs_forecast_lock" timestamp NULL,
  "caf_approved" timestamp NULL,
  "mos_af" timestamp NULL,
  "cluster_acceptance_af" timestamp NULL,
  "ic_000040_af" timestamp NULL,
  "patp_accepted_af" timestamp NULL,
  "fatp_accepted_af" date NULL,
  "ready_for_acpt_date" date NULL,
  "po_date" timestamp NULL,
  "dati_ii" text NULL,
  "province" text NULL,
  "kecamatan" text NULL,
  "sales_area" text NULL,
  "priority_congest_urgent" text NULL,
  "prio_type" text NULL,
  "ic_000010_af" timestamp NULL,
  "rfi_accepted" timestamp NULL,
  "caf_submitted" timestamp NULL,
  "permit_af" timestamp NULL,
  "rfs_actual" timestamp NULL,
  "rfs_forecast" timestamp NULL,
  "pic_indosat" text NULL,
  "donor_id" text NULL,
  "donor_name" text NULL,
  "CR.cr_number" text NULL,
  "CR.cr_status" text NULL,
  "TLP.SBOQ.system_key" text NULL,
  "TLP.site_id" text NULL,
  "TLP.site_status" text NULL,
  "TLP.issue_category" text NULL,
  "TLP.ic_000010_ff" timestamp NULL,
  "TLP.ic_000010_af" timestamp NULL,
  "TLP.fe_readiness_plan" timestamp NULL,
  "TLP.rfi_accepted" timestamp NULL,
  "Opticalization.SBOQ.system_key" text NULL,
  "Opticalization.site_id" text NULL,
  "Opticalization.site_status" text NULL,
  "Opticalization.rfs_ff" timestamp NULL,
  "short_extention" text NULL,
  "readiness_2600_af" timestamp NULL,
  "activation_2600_af" timestamp NULL,
  "readiness_700_af" timestamp NULL,
  "activation_700_af" timestamp NULL,
  "ftr_submit" timestamp NULL,
  PRIMARY KEY ("system_key")
);

DROP TABLE IF EXISTS public."site_data_aop" CASCADE;
CREATE TABLE public."site_data_aop" (
  "id" integer NOT NULL,
  "system_key" text NOT NULL,
  "site_id" text NULL,
  "site_name" text NULL,
  "region" text NULL,
  "region_circle" text NULL,
  "site_category" text NULL,
  "site_status" text NULL,
  "project_name" text NULL,
  "project_type" text NULL,
  "vendor_name" text NULL,
  "scope_category" text NULL,
  "year" text NULL,
  "wbs_status" text NULL,
  "ran_score" text NULL,
  "program_report" text NULL,
  "issue_category" text NULL,
  "latitude" double precision NULL,
  "longitude" double precision NULL,
  "ic_000010_af" timestamp NULL,
  "rfi_accepted" timestamp NULL,
  "rfs_af" timestamp NULL,
  "rfs_ff" timestamp NULL,
  "rfs_bf" timestamp NULL,
  "rfs_forecast" timestamp NULL,
  "rfs_actual" timestamp NULL,
  "mocn_activation_forecast" timestamp NULL,
  "hotnews_af" timestamp NULL,
  "endorse_af" timestamp NULL,
  "pac_accepted_af" timestamp NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "mos_af" timestamp NULL,
  "imp_integ_af" timestamp NULL,
  "rfc_approved" timestamp NULL,
  "priority_congest_urgent" text NULL,
  "tx_vendor" text NULL,
  "po_date" date NULL,
  "long" text NULL,
  "lat" text NULL,
  "ic_000040_af" date NULL,
  "ready_for_acpt_date" timestamp NULL,
  "po_number" text NULL,
  "pic_indosat" text NULL,
  "rfs_forecast_lock" timestamp NULL,
  "fatp_accepted_af" timestamp NULL,
  "patp_accepted_af" timestamp NULL,
  "pm_indosat" text NULL,
  PRIMARY KEY ("system_key")
);

DROP TABLE IF EXISTS public."site_data_caf" CASCADE;
CREATE TABLE public."site_data_caf" (
  "id" bigint GENERATED ALWAYS AS IDENTITY,
  "row_no" integer NULL,
  "caf_number" text NULL,
  "caf_status" text NULL,
  "caf_type" text NULL,
  "project_name" text NULL,
  "site_id_indosat" text NULL,
  "site_name" text NULL,
  "site_id_tlp" text NULL,
  "vendor_tlp_name" text NULL,
  "vendor_requestor_name" text NULL,
  "system_key" text NULL,
  "wo_no_tlp" text NULL,
  "avp" text NULL,
  "staff" text NULL,
  "tlp_result" text NULL,
  "created_date" date NULL,
  "modified_date" date NULL,
  "approved_date" date NULL,
  "implemented_date" date NULL,
  "avp_approved_date" date NULL,
  "status_duration" text NULL,
  "remark" text NULL,
  "imported_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  "rfs_af" date NULL,
  "patp_accepted_af" date NULL,
  "endorse_af" date NULL,
  "sboq_project_type" text NULL,
  PRIMARY KEY ("id")
);

DROP TABLE IF EXISTS public."site_data_cme" CASCADE;
CREATE TABLE public."site_data_cme" (
  "system_key" text NOT NULL,
  "SBOQ.project_type" text NULL,
  "program" text NULL,
  "project" text NULL,
  "relo_id" text NULL,
  "relo_name" text NULL,
  "site_id" text NULL,
  "site_name" text NULL,
  "new_site_id" text NULL,
  "new_site_name" text NULL,
  "year" text NULL,
  "budget_year" text NULL,
  "po_date" timestamp NULL,
  "po_quarter" text NULL,
  "ne" text NULL,
  "wbs_status" text NULL,
  "scope_of_work" text NULL,
  "scope_category" text NULL,
  "site_category" text NULL,
  "summary_scope" text NULL,
  "region_circle" text NULL,
  "region" text NULL,
  "region_wise" text NULL,
  "vendor" text NULL,
  "vendor_code" text NULL,
  "site_status" text NULL,
  "pm_indosat" text NULL,
  "network_header" text NULL,
  "po_number" text NULL,
  "wh_inbound_bf" timestamp NULL,
  "mos_bf" timestamp NULL,
  "ic_000040_bf" timestamp NULL,
  "cme_000010_bf" timestamp NULL,
  "cme_000030_bf" timestamp NULL,
  "imp_integ_bf" timestamp NULL,
  "rfs_bf" timestamp NULL,
  "patp_submitted_bf" timestamp NULL,
  "patp_accepted_bf" timestamp NULL,
  "endorse_bf" timestamp NULL,
  "dc_bf" timestamp NULL,
  "pac_accepted_bf" timestamp NULL,
  "fac_bf" timestamp NULL,
  "po_002010_po" text NULL,
  "mos_af" timestamp NULL,
  "ic_000040_af" timestamp NULL,
  "cme_000010_af" timestamp NULL,
  "cme_000030_af" timestamp NULL,
  "imp_integ_af" timestamp NULL,
  "rfs_af" timestamp NULL,
  "ready_for_acpt_date" timestamp NULL,
  "patp_submitted_af" timestamp NULL,
  "patp_accepted_af" timestamp NULL,
  "endorse_af" timestamp NULL,
  "pac_accepted_af" timestamp NULL,
  "fac_af" timestamp NULL,
  "installation_status" text NULL,
  "remarks" text NULL,
  "patp_status" text NULL,
  "pac_status" text NULL,
  "imp_integ_ff" timestamp NULL,
  "rfs_ff" timestamp NULL,
  "bongkar_rampung_bf" timestamp NULL,
  "site_dismantle_bf" timestamp NULL,
  "bongkar_rampung_ff" timestamp NULL,
  "site_dismantle_ff" timestamp NULL,
  "wh_inbound_ff" timestamp NULL,
  "bongkar_rampung_af" timestamp NULL,
  "site_dismantle_af" timestamp NULL,
  "wh_inbound_af" timestamp NULL,
  "dc_af" timestamp NULL,
  "pac_submit" timestamp NULL,
  "pac_number" text NULL,
  "kk_submit" timestamp NULL,
  "delay_kk_no" text NULL,
  "delay_status" text NULL,
  "fac_number" text NULL,
  "fac_obstacle" text NULL,
  "ne_atp" text NULL,
  "final_acceptance_status" text NULL,
  "atp_endorse_obstacle" text NULL,
  "patp_obstacle" text NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  PRIMARY KEY ("system_key")
);

DROP TABLE IF EXISTS public."site_data_prio" CASCADE;
CREATE TABLE public."site_data_prio" (
  "system_key" text NOT NULL,
  "SBOQ.project_type" text NULL,
  "site_id" text NULL,
  "priority_congest_urgent" text NULL,
  "vendor_name" text NULL,
  "rfs_af" timestamp NULL,
  "created_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "updated_at" timestamp DEFAULT CURRENT_TIMESTAMP NULL,
  "ran_scope" text NULL,
  PRIMARY KEY ("system_key")
);

DROP TABLE IF EXISTS public."site_data_sanitation_report" CASCADE;
CREATE TABLE public."site_data_sanitation_report" (
  "rfs_af" timestamptz NULL,
  "endorse_af" timestamptz NULL,
  "patp_accepted_af" timestamptz NULL,
  "caf.caf_no" text NOT NULL,
  "caf.status" text NULL,
  "imported_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY ("caf.caf_no")
);

DROP TABLE IF EXISTS public."site_data_tlp" CASCADE;
CREATE TABLE public."site_data_tlp" (
  "system_key" text NOT NULL,
  "SBOQ.project_type" text NULL,
  "network_header" text NULL,
  "project_name" text NULL,
  "program_name" text NULL,
  "site_id" text NULL,
  "site_name" text NULL,
  "wbs_status" text NULL,
  "year" text NULL,
  "new_site_id" text NULL,
  "new_site_name" text NULL,
  "region" text NULL,
  "site_category" text NULL,
  "twr_owner" text NULL,
  "vendor_code" text NULL,
  "MTWS.wo_number" text NULL,
  "wo_number_1" text NULL,
  "wo_date_1" date NULL,
  "bauf_actual" date NULL,
  "ic_000010_bf" date NULL,
  "ic_000010_ff" date NULL,
  "ic_000010_af" date NULL,
  "rfi_accepted" date NULL,
  "site_status" text NULL,
  "progress_status" text NULL,
  "fe_readiness_plan" date NULL,
  "issue_category" text NULL,
  "Opticalization.site_status" text NULL,
  "Opticalization.rfs_ff" date NULL,
  "RF.rfs_af" date NULL,
  "price_month_actual" text NULL,
  "site_id_tlp" text NULL,
  "bauf_date" date NULL,
  "lease_start_clause" text NULL,
  "lease_start_date" date NULL,
  "administration_status" text NULL,
  "booking_status" text NULL,
  "issue_ny_sc" text NULL,
  "iom_date" date NULL,
  "iom_number" text NULL,
  "sc_number" text NULL,
  "po_number" text NULL,
  "baps_submit_date" date NULL,
  "baps_number" text NULL,
  "baps_date" date NULL,
  "baps_status" text NULL,
  "audit" text NULL,
  "Opticalization.rfs_af" date NULL,
  "Document.project" text NULL,
  "year_from_wo" integer GENERATED ALWAYS AS (tlp_parse_year_from_wo_number(wo_number_1)) STORED,
  "region_circle" text NULL,
  "program_group" text NULL,
  "ran_vendor" text NULL,
  "return_replacement_status" text NULL,
  PRIMARY KEY ("system_key")
);


CREATE OR REPLACE FUNCTION public.get_aop_stats(p_vendor_names text[] DEFAULT NULL::text[], p_program_reports text[] DEFAULT NULL::text[], p_circles text[] DEFAULT NULL::text[], p_site_categories text[] DEFAULT NULL::text[], p_search text DEFAULT NULL::text)
 RETURNS TABLE(total_sites bigint, caf_count bigint, mos_count bigint, install_count bigint, readiness_count bigint, activated_count bigint, rfc_count bigint, hotnews_count bigint, endorse_count bigint, pac_count bigint, cluster_count bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  WITH filtered_data AS (
    SELECT *
    FROM site_data_aop
    WHERE
      (p_vendor_names IS NULL OR array_length(p_vendor_names, 1) IS NULL OR vendor_name = ANY(p_vendor_names))
      AND (p_program_reports IS NULL OR array_length(p_program_reports, 1) IS NULL OR program_report = ANY(p_program_reports))
      AND (p_circles IS NULL OR array_length(p_circles, 1) IS NULL OR
           LOWER(TRIM(region_circle)) = ANY(SELECT LOWER(TRIM(unnest(p_circles)))))
      AND (p_site_categories IS NULL OR array_length(p_site_categories, 1) IS NULL OR
           LOWER(TRIM(site_category)) = ANY(SELECT LOWER(TRIM(unnest(p_site_categories)))))
      AND (p_search IS NULL OR p_search = '' OR
           system_key ILIKE '%' || p_search || '%' OR
           site_id ILIKE '%' || p_search || '%' OR
           site_name ILIKE '%' || p_search || '%' OR
           vendor_name ILIKE '%' || p_search || '%')
  )
  SELECT
    COUNT(*)::BIGINT as total_sites,
    COUNT(*) FILTER (WHERE rfi_accepted IS NOT NULL)::BIGINT as caf_count,
    COUNT(*) FILTER (WHERE mos_af IS NOT NULL)::BIGINT as mos_count,
    COUNT(*) FILTER (WHERE ic_000040_af IS NOT NULL)::BIGINT as install_count,
    COUNT(*) FILTER (WHERE imp_integ_af IS NOT NULL)::BIGINT as readiness_count,
    COUNT(*) FILTER (WHERE rfs_af IS NOT NULL)::BIGINT as activated_count,
    COUNT(*) FILTER (WHERE rfc_approved IS NOT NULL)::BIGINT as rfc_count,
    COUNT(*) FILTER (WHERE hotnews_af IS NOT NULL)::BIGINT as hotnews_count,
    COUNT(*) FILTER (WHERE endorse_af IS NOT NULL)::BIGINT as endorse_count,
    COUNT(*) FILTER (WHERE pac_accepted_af IS NOT NULL)::BIGINT as pac_count,
    COUNT(DISTINCT region_circle) FILTER (WHERE region_circle IS NOT NULL)::BIGINT as cluster_count
  FROM filtered_data;
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_site_data_aop_filters ON public.site_data_aop USING btree (vendor_name, program_report, region_circle, site_category);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_program_report ON public.site_data_aop USING btree (program_report);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_vendor_name ON public.site_data_aop USING btree (vendor_name);
CREATE INDEX IF NOT EXISTS idx_site_data_aop_region_circle ON public.site_data_aop USING btree (region_circle);
CREATE INDEX IF NOT EXISTS idx_site_data_caf_system_key ON public.site_data_caf USING btree (system_key);
CREATE INDEX IF NOT EXISTS idx_site_data_caf_caf_status ON public.site_data_caf USING btree (caf_status);
CREATE INDEX IF NOT EXISTS idx_site_data_tlp_region_circle ON public.site_data_tlp USING btree (region_circle) WHERE (region_circle IS NOT NULL);
CREATE INDEX IF NOT EXISTS idx_site_data_tlp_year_from_wo ON public.site_data_tlp USING btree (year_from_wo) WHERE (year_from_wo IS NOT NULL);

COMMIT;