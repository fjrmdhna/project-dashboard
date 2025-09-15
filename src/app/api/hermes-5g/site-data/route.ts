import { NextRequest, NextResponse } from 'next/server'
import { getSiteData5G } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    
    // Use Supabase to get site data
    const { data, count } = await getSiteData5G({
      vendor_name: vendorNames.length > 0 ? vendorNames : undefined,
      program_report: programReports.length > 0 ? programReports : undefined,
      imp_ttp: impTtps.length > 0 ? impTtps : undefined,
      search: q || undefined,
      limit: 10000
    })
    
    // Hitung jumlah untuk masing-masing metrik
    const cafCount = data.filter(row => row.caf_approved).length
    const mosCount = data.filter(row => row.mos_af).length
    const installCount = data.filter(row => row.ic_000040_af).length
    const readinessCount = data.filter(row => row.imp_integ_af).length
    const activatedCount = data.filter(row => row.rfs_af).length
    const hotnewsCount = data.filter(row => row.hotnews_af).length
    const endorseCount = data.filter(row => row.endorse_af).length
    
    // Hitung jumlah nano cluster
    const uniqueClusters = new Set()
    data.forEach(row => {
      if (row.nano_cluster) {
        uniqueClusters.add(row.nano_cluster)
      }
    })
    const clusterCount = uniqueClusters.size
    
    // Log untuk debugging
    console.log('Data counts:', {
      total: data.length,
      caf: cafCount,
      mos: mosCount,
      install: installCount,
      readiness: readinessCount,
      activated: activatedCount,
      hotnews: hotnewsCount,
      endorse: endorseCount,
      clusters: clusterCount
    })
    
    return NextResponse.json({
      status: 'success',
      data,
      timestamp: new Date().toISOString(),
      filtered: vendorNames.length > 0 || programReports.length > 0 || impTtps.length > 0 || q.length > 0,
      count: data.length,
      totalCount: count,
      metrics: {
        caf: cafCount,
        mos: mosCount,
        install: installCount,
        readiness: readinessCount,
        activated: activatedCount,
        hotnews: hotnewsCount,
        endorse: endorseCount,
        clusters: clusterCount
      }
    })
  } catch (error) {
    console.error('Error fetching site data:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch site data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
