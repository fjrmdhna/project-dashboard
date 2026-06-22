const AOP_TIMESTAMP_COLUMNS = new Set([
  'ic_000010_af',
  'rfi_accepted',
  'rfs_af',
  'rfs_ff',
  'rfs_bf',
  'rfs_forecast',
  'rfs_actual',
  'mocn_activation_forecast',
  'hotnews_af',
  'endorse_af',
  'pac_accepted_af',
  'mos_af',
  'imp_integ_af',
  'rfc_approved',
  'ready_for_acpt_date',
  'rfs_forecast_lock',
  'fatp_accepted_af',
  'patp_accepted_af',
])

const AOP_DATE_COLUMNS = new Set(['ic_000040_af', 'po_date'])

export const AOP_EXCEL_HEADER_TO_DB: Record<string, string> = {
  system_key: 'system_key',
  'SBOQ.project_type': 'project_type',
  site_id: 'site_id',
  site_name: 'site_name',
  'RF.region': 'region',
  region_circle: 'region_circle',
  site_category: 'site_category',
  site_status: 'site_status',
  project_name: 'project_name',
  vendor_name: 'vendor_name',
  scope_category: 'scope_category',
  year: 'year',
  wbs_status: 'wbs_status',
  ran_score: 'ran_score',
  program_report: 'program_report',
  issue_category: 'issue_category',
  ic_000010_af: 'ic_000010_af',
  rfi_accepted: 'rfi_accepted',
  rfs_af: 'rfs_af',
  rfs_ff: 'rfs_ff',
  rfs_bf: 'rfs_bf',
  rfs_forecast: 'rfs_forecast',
  rfs_actual: 'rfs_actual',
  mocn_activation_forecast: 'mocn_activation_forecast',
  hotnews_af: 'hotnews_af',
  endorse_af: 'endorse_af',
  pac_accepted_af: 'pac_accepted_af',
  mos_af: 'mos_af',
  imp_integ_af: 'imp_integ_af',
  rfc_approved: 'rfc_approved',
  priority_congest_urgent: 'priority_congest_urgent',
  tx_vendor: 'tx_vendor',
  po_date: 'po_date',
  long: 'long',
  lat: 'lat',
  ic_000040_af: 'ic_000040_af',
  patp_accepted_af: 'patp_accepted_af',
  ready_for_acpt_date: 'ready_for_acpt_date',
  po_number: 'po_number',
  pic_indosat: 'pic_indosat',
  rfs_forecast_lock: 'rfs_forecast_lock',
  fatp_accepted_af: 'fatp_accepted_af',
  pm_indosat: 'pm_indosat',
}

function excelSerialToIsoDate(serial: number): string | null {
  if (serial < 1 || serial > 2958465) return null
  const actualDays = serial >= 60 ? serial - 2 : serial - 1
  const epoch = Date.UTC(1900, 0, 1)
  const target = new Date(epoch + actualDays * 86400000)
  const y = target.getUTCFullYear()
  const m = String(target.getUTCMonth() + 1).padStart(2, '0')
  const d = String(target.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function parseAopExcelDate(value: unknown): string | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10)
  }
  if (typeof value === 'number') {
    return excelSerialToIsoDate(Math.floor(value))
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return null
    const ddmmyyyy = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
    if (ddmmyyyy) {
      const day = ddmmyyyy[1].padStart(2, '0')
      const month = ddmmyyyy[2].padStart(2, '0')
      const year = ddmmyyyy[3]
      return `${year}-${month}-${day}`
    }
    const iso = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/)
    if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`
    const parsed = new Date(trimmed)
    return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 10)
  }
  return null
}

function toTimestampValue(value: unknown): string | null {
  const date = parseAopExcelDate(value)
  return date ? `${date}T00:00:00` : null
}

export function mapAopExcelRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const mapped: Record<string, unknown> = {}

  for (const [header, rawValue] of Object.entries(row)) {
    const dbColumn = AOP_EXCEL_HEADER_TO_DB[header]
    if (!dbColumn) continue

    if (rawValue === null || rawValue === undefined || rawValue === '') {
      mapped[dbColumn] = null
      continue
    }

    if (AOP_TIMESTAMP_COLUMNS.has(dbColumn)) {
      mapped[dbColumn] = toTimestampValue(rawValue)
    } else if (AOP_DATE_COLUMNS.has(dbColumn)) {
      mapped[dbColumn] = parseAopExcelDate(rawValue)
    } else if (typeof rawValue === 'string') {
      mapped[dbColumn] = rawValue.trim() || null
    } else {
      mapped[dbColumn] = rawValue
    }
  }

  const systemKey = mapped.system_key
  if (systemKey === null || systemKey === undefined || String(systemKey).trim() === '') {
    return null
  }

  mapped.system_key = String(systemKey).trim()
  return mapped
}
