import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'
import { requireApiKey } from '@/lib/api-auth'

export async function GET(request: Request) {
  try {
    // Validate API key
    const authError = requireApiKey(request)
    if (authError) {
      return authError
    }
    // Fetch distinct values for filters
    const [regionsResult, vendorsResult, programsResult] = await Promise.all([
      supabase
        .from('site_data_tlp')
        .select('region')
        .not('region', 'is', null)
        .neq('region', ''),
      supabase
        .from('site_data_tlp')
        .select('vendor_code')
        .not('vendor_code', 'is', null)
        .neq('vendor_code', ''),
      supabase
        .from('site_data_tlp')
        .select('program_name')
        .not('program_name', 'is', null)
        .neq('program_name', ''),
    ])

    // Check for errors
    if (regionsResult.error) {
      console.error('Error fetching regions:', regionsResult.error)
    }
    if (vendorsResult.error) {
      console.error('Error fetching vendors:', vendorsResult.error)
    }
    if (programsResult.error) {
      console.error('Error fetching programs:', programsResult.error)
    }

    // Extract unique values and sort
    const regions = [...new Set((regionsResult.data || []).map(r => r.region))].filter(Boolean).sort()
    const vendors = [...new Set((vendorsResult.data || []).map(v => v.vendor_code))].filter(Boolean).sort()
    const programs = [...new Set((programsResult.data || []).map(p => p.program_name))].filter(Boolean).sort()

    return NextResponse.json({
      status: 'success',
      data: {
        regions,
        vendors,
        programs,
      },
      timestamp: new Date().toISOString(),
    })

  } catch (error) {
    console.error('Error fetching filter options:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch filter options',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    )
  }
}

