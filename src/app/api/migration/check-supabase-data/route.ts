import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const programFilter = searchParams.get('programFilter')
    
    console.log(`🔍 Checking Supabase data for program: ${programFilter}`)
    
    let query = supabase.from('site_data_5g').select('*', { count: 'exact' })
    
    if (programFilter && programFilter !== 'all') {
      query = query.eq('program_report', programFilter)
    }
    
    const { data, error, count } = await query
    
    if (error) {
      console.error('❌ Supabase error:', error)
      return NextResponse.json(
        {
          status: 'error',
          message: 'Failed to fetch data from Supabase',
          error: error.message,
          timestamp: new Date().toISOString()
        },
        { status: 500 }
      )
    }
    
    // Get sample data for inspection
    const sampleData = data?.slice(0, 3) || []
    
    // Get unique program_report values with counts
    const { data: allPrograms } = await supabase
      .from('site_data_5g')
      .select('program_report')
      .not('program_report', 'is', null)
    
    const programCounts: { [key: string]: number } = {}
    allPrograms?.forEach(item => {
      if (item.program_report) {
        programCounts[item.program_report] = (programCounts[item.program_report] || 0) + 1
      }
    })
    
    const uniquePrograms = Object.entries(programCounts).map(([program, count]) => `${program} : ${count} sites`)
    
    return NextResponse.json({
      status: 'success',
      data: {
        totalCount: count || 0,
        sampleData,
        uniquePrograms,
        programFilter,
        hasData: (data?.length || 0) > 0,
        rawCount: data?.length || 0
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Check Supabase data failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Check Supabase data failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 