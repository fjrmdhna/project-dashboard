import type { SupabaseClient } from '@supabase/supabase-js'
import * as XLSX from 'xlsx'
import {
  EXCEL_ALLOWED_MIME_TYPES,
  EXCEL_UPLOAD_BATCH_SIZE,
  EXCEL_UPLOAD_MAX_BYTES,
} from '@/lib/excel-upload-utils'

export type ExcelCellValue = unknown
export type ExcelRow = Record<string, ExcelCellValue>

export function excelDateToISO(value: ExcelCellValue): string | null {
  if (value === null || value === undefined || value === '') return null
  try {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value.toISOString()
    }
    if (typeof value === 'number') {
      const date = new Date(Math.round((value - 25569) * 86400 * 1000))
      return Number.isNaN(date.getTime()) ? null : date.toISOString()
    }
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) return null
      const date = new Date(trimmed)
      return Number.isNaN(date.getTime()) ? null : date.toISOString()
    }
    return null
  } catch {
    return null
  }
}

export function toDateOnly(value: ExcelCellValue): string | null {
  const iso = excelDateToISO(value)
  return iso ? iso.slice(0, 10) : null
}

export function stringOrNull(value: ExcelCellValue): string | null {
  if (value === null || value === undefined) return null
  const s = String(value).trim()
  return s.length > 0 ? s : null
}

export function numberOrNull(value: ExcelCellValue): number | null {
  if (value === null || value === undefined || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** Parse Excel with first row skipped (header on row 2) — swap_progress convention. */
export function parseExcelSkipFirstRow(
  buffer: Buffer,
  options?: { cellDates?: boolean }
): ExcelRow[] {
  const workbook = XLSX.read(buffer, {
    type: 'buffer',
    cellDates: options?.cellDates ?? false,
  })
  const sheetName = workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  return XLSX.utils.sheet_to_json(sheet, {
    range: 1,
    raw: false,
    dateNF: 'yyyy-mm-dd',
    defval: null,
  }) as ExcelRow[]
}

export async function readExcelUploadFile(
  request: Request
): Promise<{ file: File; buffer: Buffer } | { error: Response }> {
  const contentLength = Number(request.headers.get('content-length') ?? '0')
  if (contentLength > EXCEL_UPLOAD_MAX_BYTES) {
    return {
      error: Response.json(
        {
          success: false,
          error: 'File too large',
          message: `File size exceeds maximum limit of ${EXCEL_UPLOAD_MAX_BYTES / 1024 / 1024}MB`,
        },
        { status: 413 }
      ),
    }
  }

  const formData = await request.formData()
  const file = formData.get('file')

  if (!(file instanceof File)) {
    return {
      error: Response.json(
        { success: false, error: 'No file provided', message: 'Use multipart field "file".' },
        { status: 400 }
      ),
    }
  }

  if (file.type && !EXCEL_ALLOWED_MIME_TYPES.includes(file.type)) {
    // Allow empty/octet-stream from some uploaders; reject known non-excel types only
    const looksExcel = /\.(xlsx|xls|xlsm)$/i.test(file.name)
    if (!looksExcel) {
      return {
        error: Response.json(
          {
            success: false,
            error: 'Invalid file type',
            message: 'Please upload an Excel file (.xlsx, .xls, .xlsm)',
          },
          { status: 400 }
        ),
      }
    }
  }

  if (file.size > EXCEL_UPLOAD_MAX_BYTES) {
    return {
      error: Response.json(
        {
          success: false,
          error: 'File too large',
          message: `File size exceeds maximum limit of ${EXCEL_UPLOAD_MAX_BYTES / 1024 / 1024}MB`,
        },
        { status: 413 }
      ),
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  return { file, buffer }
}

export async function upsertChunks(
  supabase: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  options?: { chunkSize?: number; concurrency?: number }
): Promise<number> {
  if (rows.length === 0) return 0

  const chunkSize =
    options?.chunkSize ??
    (rows.length <= 1000 ? 250 : EXCEL_UPLOAD_BATCH_SIZE)
  const concurrency = options?.concurrency ?? (rows.length <= 1000 ? 5 : 8)

  const chunks: Record<string, unknown>[][] = []
  for (let i = 0; i < rows.length; i += chunkSize) {
    chunks.push(rows.slice(i, i + chunkSize))
  }

  let uploaded = 0
  for (let i = 0; i < chunks.length; i += concurrency) {
    const batch = chunks.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(async (chunk) => {
        const { error } = await supabase.from(table).upsert(chunk, {
          onConflict: 'system_key',
          ignoreDuplicates: false,
        })
        if (error) {
          throw new Error(error.message || `Upsert failed for ${table}`)
        }
        return chunk.length
      })
    )
    uploaded += results.reduce((sum, n) => sum + n, 0)
  }

  return uploaded
}
