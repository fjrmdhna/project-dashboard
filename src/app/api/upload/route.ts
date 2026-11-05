import { NextResponse } from 'next/server'
import { requireApiKey } from '@/lib/api-auth'
import { getServerSupabase } from '@/lib/server-supabase'
import { mapSiteDataExcelRow } from '@/lib/site-data-excel-mapper'
import {
  parseExcelSkipFirstRow,
  readExcelUploadFile,
  upsertChunks,
} from '@/lib/upload-gateway-utils'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const authError = requireApiKey(request, 'PMIS_API_KEY')
    if (authError) return authError

    const fileResult = await readExcelUploadFile(request)
    if ('error' in fileResult) return fileResult.error

    const jsonData = parseExcelSkipFirstRow(fileResult.buffer)
    const transformedData = jsonData
      .map(mapSiteDataExcelRow)
      .filter((row): row is Record<string, unknown> => row !== null)

    console.log(`[upload] file=${fileResult.file.name} rows=${transformedData.length}`)

    const supabase = getServerSupabase()
    await upsertChunks(supabase, 'site_data', transformedData, {
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
    console.error('[upload] Error:', error)
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
