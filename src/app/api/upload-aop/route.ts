import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api-auth'
import { mapAopExcelRow } from '@/lib/aop-excel-mapper'
import {
  EXCEL_ALLOWED_MIME_TYPES,
  EXCEL_UPLOAD_BATCH_SIZE,
  EXCEL_UPLOAD_MAX_BYTES,
  parseExcelWithSecondRowHeader,
  validateSystemKeyRow,
} from '@/lib/excel-upload-utils'
import { supabase } from '@/lib/supabase'

export const maxDuration = 60

interface UploadResult {
  success: boolean
  totalRows: number
  insertedCount: number
  skippedCount: number
  errors: Array<{ row: number; error: string }>
  message: string
}

async function upsertBatch(rows: Record<string, unknown>[]) {
  const { data, error } = await supabase
    .from('site_data_aop')
    .upsert(rows, { onConflict: 'system_key', ignoreDuplicates: false })
    .select('system_key')

  if (error) throw error
  return data?.length ?? 0
}

export async function POST(request: Request) {
  const contentLengthHeader = request.headers.get('content-length')

  try {
    const authError = requireApiKey(request)
    if (authError) return authError

    const contentLength = Number(contentLengthHeader ?? '0')
    if (contentLength > EXCEL_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          status: 'error',
          message: `File size exceeds maximum limit of ${EXCEL_UPLOAD_MAX_BYTES / 1024 / 1024}MB`,
        },
        { status: 413 }
      )
    }

    const formData = await request.formData()
    const file = formData.get('file')

    if (!(file instanceof File)) {
      return NextResponse.json(
        { status: 'error', message: 'No file provided. Use multipart field "file".' },
        { status: 400 }
      )
    }

    if (file.type && !EXCEL_ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'Invalid file type. Please upload an Excel file (.xlsx, .xls, .xlsm)',
        },
        { status: 400 }
      )
    }

    if (file.size > EXCEL_UPLOAD_MAX_BYTES) {
      return NextResponse.json(
        {
          status: 'error',
          message: `File size exceeds maximum limit of ${EXCEL_UPLOAD_MAX_BYTES / 1024 / 1024}MB`,
        },
        { status: 413 }
      )
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const rawRows = parseExcelWithSecondRowHeader(buffer)

    if (rawRows.length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'Excel file is empty or has no data rows' },
        { status: 400 }
      )
    }

    const processedRows: Record<string, unknown>[] = []
    const errors: Array<{ row: number; error: string }> = []

    for (let i = 0; i < rawRows.length; i++) {
      const excelRowNumber = i + 3
      const mapped = mapAopExcelRow(rawRows[i])
      if (!mapped) {
        errors.push({ row: excelRowNumber, error: 'Missing or empty system_key' })
        continue
      }

      const validation = validateSystemKeyRow(mapped)
      if (!validation.valid) {
        errors.push({ row: excelRowNumber, error: validation.error ?? 'Validation failed' })
        continue
      }

      processedRows.push(mapped)
    }

    if (processedRows.length === 0) {
      return NextResponse.json(
        {
          status: 'error',
          message: 'No valid data rows found after validation',
          errors,
        },
        { status: 400 }
      )
    }

    let insertedCount = 0
    for (let i = 0; i < processedRows.length; i += EXCEL_UPLOAD_BATCH_SIZE) {
      const batch = processedRows.slice(i, i + EXCEL_UPLOAD_BATCH_SIZE)
      try {
        insertedCount += await upsertBatch(batch)
      } catch (error) {
        errors.push({
          row: i + 3,
          error: error instanceof Error ? error.message : 'Batch upsert failed',
        })
      }
    }

    const result: UploadResult = {
      success: errors.length === 0,
      totalRows: rawRows.length,
      insertedCount,
      skippedCount: rawRows.length - processedRows.length,
      errors,
      message:
        errors.length === 0
          ? `Successfully uploaded ${insertedCount} rows to site_data_aop`
          : `Uploaded ${insertedCount} rows with ${errors.length} errors`,
    }

    return NextResponse.json({
      status: result.success ? 'success' : 'partial_success',
      ...result,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[upload-aop] Error:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to upload AOP Excel file',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}
