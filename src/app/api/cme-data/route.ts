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

const CME_PAGE_SIZE = 1000

export async function GET(request: Request) {
  try {
    const authError = requireApiKey(request, 'PMIS_CME_API_KEY')
    if (authError) return authError

    const supabase = getServerSupabase()
    const rows: Record<string, unknown>[] = []

    for (let from = 0; ; from += CME_PAGE_SIZE) {
      const { data, error } = await supabase
        .from('site_data_cme')
        .select('*')
        .order('system_key', { ascending: true })
        .range(from, from + CME_PAGE_SIZE - 1)

      if (error) throw error
      if (!data?.length) break
      rows.push(...(data as Record<string, unknown>[]))
      if (data.length < CME_PAGE_SIZE) break
    }

    return NextResponse.json({
      success: true,
      data: rows,
      count: rows.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[cme-data GET] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

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

    console.log(`[cme-data POST] file=${fileResult.file.name} rows=${transformedData.length}`)

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
    console.error('[cme-data POST] Error:', error)
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
