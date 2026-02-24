// Column definitions for AOP site data export
// These columns match the FULL_COLUMNS from site-data route plus additional fields

export const SITE_DATA_AOP_SELECT_COLUMNS = [
  'system_key',
  'vendor_name',
  'program_report',
  'rfi_accepted', // CRFI
  'mos_af',
  'ic_000010_af', // RFI
  'ic_000040_af', // INSTALL
  'imp_integ_af',
  'rfs_bf', // Baseline
  'rfs_ff', // Forecast
  'rfs_af', // Actual (Activated/RFS)
  'ready_for_acpt_date', // RFA
  'rfc_approved',
  'fatp_accepted_af', // FATP - Matrix milestone
  'patp_accepted_af', // PATP - Matrix milestone
  'ran_score',
  'hotnews_af', // HN
  'endorse_af', // Endorse
  'pac_accepted_af', // PAC
  'site_id',
  'site_name',
  'latitude',
  'longitude',
  'region',
  'region_circle',
  'site_category',
  'wbs_status',
  'year',
  'project_name',
  'po_date',
  'issue_category',
  'priority_congest_urgent',
  'mocn_activation_forecast'
] as const

export const SITE_DATA_AOP_HEADERS = [
  'system_key',
  'vendor_name',
  'program_report',
  'rfi_accepted', // CRFI
  'mos_af',
  'ic_000010_af', // RFI
  'ic_000040_af', // INSTALL
  'imp_integ_af',
  'rfs_bf', // Baseline
  'rfs_ff', // Forecast
  'rfs_af', // Actual (Activated/RFS)
  'ready_for_acpt_date', // RFA
  'rfc_approved',
  'fatp_accepted_af', // FATP
  'patp_accepted_af', // PATP
  'ran_score',
  'hotnews_af', // HN
  'endorse_af', // Endorse
  'pac_accepted_af', // PAC
  'site_id',
  'site_name',
  'latitude',
  'longitude',
  'region',
  'region_circle',
  'site_category',
  'wbs_status',
  'year',
  'project_name',
  'po_date',
  'issue_category',
  'priority_congest_urgent',
  'mocn_activation_forecast'
] as const

export type SiteDataAopHeader = typeof SITE_DATA_AOP_HEADERS[number]
