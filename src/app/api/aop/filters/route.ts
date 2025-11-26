import { NextResponse } from 'next/server'
import { getAopFilterOptions } from '@/lib/supabase'

export async function GET() {
  try {
    const options = await getAopFilterOptions()

    return NextResponse.json({
      status: 'success',
      data: options,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error fetching AOP filter options:', error)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch AOP filter options' },
      { status: 500 }
    )
  }
}

