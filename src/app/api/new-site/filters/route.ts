import { NextResponse } from 'next/server'
import { getNewSiteFilterOptions } from '@/lib/supabase'

export async function GET() {
  try {
    const options = await getNewSiteFilterOptions()

    return NextResponse.json({
      status: 'success',
      data: options,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching New Site filter options:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch New Site filter options' },
      { status: 500 }
    )
  }
}

