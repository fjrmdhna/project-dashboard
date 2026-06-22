import * as XLSX from 'xlsx'

export const EXCEL_UPLOAD_MAX_BYTES = 20 * 1024 * 1024
export const EXCEL_UPLOAD_BATCH_SIZE = 500
export const EXCEL_ALLOWED_MIME_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'application/vnd.ms-excel.sheet.macroEnabled.12',
]

export function normalizeExcelCell(value: unknown): string | number | null {
  if (value === null || value === undefined || value === '') return null
  if (typeof value === 'string') return value.trim() || null
  return value as string | number
}

/** AOP/TLP layout: row 1 empty, row 2 header, row 3+ data */
export function parseExcelWithSecondRowHeader(buffer: Buffer): Record<string, unknown>[] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: false,
    cellNF: false,
    cellStyles: false,
  })
  const sheetName = workbook.SheetNames[0]
  const worksheet = workbook.Sheets[sheetName]

  if (!worksheet?.['!ref']) {
    throw new Error('Excel sheet is empty or invalid')
  }

  const arrayData = XLSX.utils.sheet_to_json(worksheet, {
    raw: true,
    defval: null,
    header: 1,
    blankrows: false,
  }) as unknown[][]

  if (arrayData.length < 2) {
    throw new Error('Excel file must have at least a header row (row 2)')
  }

  const headerRow = arrayData[1] as unknown[]
  const cleanHeaders = headerRow.map((header, idx) => {
    if (header === null || header === undefined || header === '') {
      return `Column_${idx + 1}`
    }
    return String(header).trim()
  })

  return (arrayData.slice(2) as unknown[][])
    .filter((row) => row?.some((cell) => cell !== null && cell !== undefined && cell !== ''))
    .map((row) => {
      const obj: Record<string, unknown> = {}
      cleanHeaders.forEach((header, idx) => {
        obj[header] = normalizeExcelCell(row?.[idx])
      })
      return obj
    })
}

export function mapRowToAllowedColumns(
  row: Record<string, unknown>,
  allowedColumns: readonly string[]
): Record<string, unknown> {
  const allowed = new Set(allowedColumns)
  const mapped: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(row)) {
    const trimmedKey = String(key).trim()
    if (allowed.has(trimmedKey)) {
      mapped[trimmedKey] = normalizeExcelCell(value)
    }
  }

  return mapped
}

export function validateSystemKeyRow(
  row: Record<string, unknown>
): { valid: boolean; error?: string } {
  const systemKey = row.system_key
  if (
    systemKey === null ||
    systemKey === undefined ||
    String(systemKey).trim() === ''
  ) {
    return { valid: false, error: 'system_key is required' }
  }
  return { valid: true }
}
