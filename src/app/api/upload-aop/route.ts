import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api-auth'
import { mapAopExcelRow } from '@/lib/aop-excel-mapper'
import { EXCEL_UPLOAD_BATCH_SIZE, validateSystemKeyRow } from '@/lib/excel-upload-utils'
import { getServerSupabase } from '@/lib/server-supabase'
import {
  deleteStaleRowsBySystemKey,
  systemKeySetFromRows,
} from '@/lib/supabase-site-sync'
import {
  parseExcelSkipFirstRow,
  readExcelUploadFile,
  upsertChunks,
} from '@/lib/upload-gateway-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const PROGRAM_REPORT_10K = '10k'
const PRIORITY_LEBARAN = 'lebaran'

function shouldKeepAopRow(row: Record<string, unknown>): boolean {
  const programReport = String(row.program_report ?? '').toLowerCase()
  const priorityCongest = String(row.priority_congest_urgent ?? '').toLowerCase()
  const pm = row.pm_indosat
  const hasPmIndosat = pm != null && String(pm).trim() !== ''
  const has10k = programReport.includes(PROGRAM_REPORT_10K)
  const hasLebaran = priorityCongest.includes(PRIORITY_LEBARAN)
  return !has10k || hasLebaran || hasPmIndosat
}

export async function POST(request: Request) {
  try {
    const authError = requireApiKey(request, ['PMIS_AOP_API_KEY', 'TLP_API_KEY', 'API_KEY'])
    if (authError) return authError

    const fileResult = await readExcelUploadFile(request)
    if ('error' in fileResult) return fileResult.error

    // Match swap_progress convention: skip first sheet row (header on row 2).
    const rawRows = parseExcelSkipFirstRow(fileResult.buffer)
    if (rawRows.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Excel file is empty or has no data rows' },
        { status: 400 }
      )
    }

    const mappedRows: Record<string, unknown>[] = []
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
      mappedRows.push(mapped)
    }

    const originalCount = mappedRows.length
    const filteredData = mappedRows.filter(shouldKeepAopRow)
    const excludedCount = originalCount - filteredData.length

    if (filteredData.length === 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'No valid data rows found after validation',
          errors,
          excludedRows: excludedCount,
        },
        { status: 400 }
      )
    }

    console.log(
      `[upload-aop] file=${fileResult.file.name} rows=${filteredData.length} excluded=${excludedCount}`
    )

    const supabase = getServerSupabase()
    const uploaded = await upsertChunks(supabase, 'site_data_aop', filteredData, {
      chunkSize: EXCEL_UPLOAD_BATCH_SIZE,
      concurrency: 5,
    })

    let deletedCount = 0
    let staleSyncError: { message: string } | null = null
    if (filteredData.length >= 100) {
      const currentKeys = systemKeySetFromRows(filteredData)
      const sync = await deleteStaleRowsBySystemKey(supabase, 'site_data_aop', currentKeys)
      deletedCount = sync.deletedCount
      staleSyncError = sync.error
      if (staleSyncError) {
        console.error('[upload-aop] Stale row sync failed:', staleSyncError.message)
      }
    }

    return NextResponse.json({
      success: errors.length === 0 && !staleSyncError,
      message: 'Upload successful',
      totalRows: filteredData.length,
      insertedCount: uploaded,
      excludedRows: excludedCount,
      originalRows: originalCount,
      deletedRows: deletedCount,
      skippedCount: rawRows.length - mappedRows.length,
      errors,
      staleSyncError: staleSyncError?.message ?? null,
      uploadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[upload-aop] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
