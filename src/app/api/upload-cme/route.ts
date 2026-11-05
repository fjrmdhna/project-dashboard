import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api-auth'
import { mapCmeExcelRow } from '@/lib/cme-excel-mapper'
import { getServerSupabase } from '@/lib/server-supabase'
import {
  parseExcelSkipFirstRow,
  readExcelUploadFile,
  upsertChunks,
} from '@/lib/upload-gateway-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const authError = requireApiKey(request, 'PMIS_CME_API_KEY')
    if (authError) return authError

    const fileResult = await readExcelUploadFile(request)
    if ('error' in fileResult) return fileResult.error

    const jsonData = parseExcelSkipFirstRow(fileResult.buffer)
    const transformedData = jsonData
      .map(mapCmeExcelRow)
      .filter((row): row is Record<string, unknown> => row !== null)

    console.log(`[upload-cme] file=${fileResult.file.name} rows=${transformedData.length}`)

    const supabase = getServerSupabase()
    await upsertChunks(supabase, 'site_data_cme', transformedData, {
      chunkSize: 500,
      concurrency: 5,
    })

    return NextResponse.json({
      success: true,
      message: 'Upload successful',
      totalRows: transformedData.length,
      uploadedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[upload-cme] Error:', error)
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
