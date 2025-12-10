import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const circles = searchParams.getAll('region_circle') || []
    
    // Select columns that exist in site_data_aop table
    // Note: site_data_aop has different structure than site_data_5g
    const columns = [
      'system_key',
      'vendor_name',
      'program_report',
      'rfi_accepted', // CAF equivalent
      'mos_af',
      'ic_000010_af', // Install equivalent (not ic_000040_af)
      'imp_integ_af',
      'rfs_bf', // Baseline
      'rfs_ff', // Forecast
      'rfs_af', // Actual (Activated)
      'rfc_approved',
      'ran_score',
      'hotnews_af', // HN
      'endorse_af', // Endorse
      'pac_accepted_af', // PAC
      'site_id',
      'site_name',
      'latitude',
      'longitude',
      'region',
      'region_circle'
    ].join(',')
    
    // Query site_data_aop table only
    // Supabase has default limit of 1000, so we need to fetch all data using pagination
    let allData: any[] = []
    let hasMore = true
    let page = 0
    const pageSize = 1000 // Supabase max per page
    
    // Build base query
    let baseQuery = supabase
      .from('site_data_aop')
      .select(columns, { count: 'exact' })
    
    // Apply filters
    if (vendorNames.length > 0) {
      baseQuery = baseQuery.in('vendor_name', vendorNames)
    }
    
    if (programReports.length > 0) {
      baseQuery = baseQuery.in('program_report', programReports)
    }
    
    // site_data_aop tidak memiliki imp_ttp/nano_cluster, gunakan region_circle untuk filtering
    
    if (circles.length > 0) {
      baseQuery = baseQuery.in('region_circle', circles)
    }

    if (q) {
      baseQuery = baseQuery.or(`system_key.ilike.%${q}%,site_id.ilike.%${q}%,site_name.ilike.%${q}%,vendor_name.ilike.%${q}%`)
    }
    
    // Fetch all data using pagination
    let totalCount = 0
    let error: any = null
    
    while (hasMore) {
      const from = page * pageSize
      const to = from + pageSize - 1
      
      const query = baseQuery.range(from, to)
      const { data: pageData, error: pageError, count } = await query
      
      if (pageError) {
        error = pageError
        break
      }
      
      if (count !== null && totalCount === 0) {
        totalCount = count
      }
      
      if (pageData && pageData.length > 0) {
        allData = [...allData, ...pageData]
        hasMore = pageData.length === pageSize
        page++
      } else {
        hasMore = false
      }
      
      // Safety check to prevent infinite loop
      if (page > 50) {
        console.warn('Pagination limit reached, stopping at page', page)
        break
      }
    }
    
    const data = allData
    const count = totalCount
    
    // If table doesn't exist or error, return empty data
    if (error) {
      if (error.code === 'PGRST116') {
        // Table doesn't exist, return empty data
        return NextResponse.json({
          status: 'success',
          data: [],
          count: 0,
          stats: {
            totalSites: 0,
            caf: 0,
            mos: 0,
            install: 0,
            readiness: 0,
            activated: 0,
            rfc: 0,
            hotnews: 0,
            endorse: 0,
            pac: 0,
            nanoClusters: 0
          },
          timestamp: new Date().toISOString()
        })
      }
      throw new Error(`Database error: ${error.message}`)
    }
    
    const filteredData = data || []
    
    // Hitung jumlah untuk masing-masing metrik berdasarkan mapping kolom site_data_aop
    // Mapping: caf_approved = rfi_accepted, ic_000040_af = ic_000010_af
    const cafCount = filteredData.filter(row => row.rfi_accepted).length
    const mosCount = filteredData.filter(row => row.mos_af).length
    const installCount = filteredData.filter(row => row.ic_000010_af).length
    const readinessCount = filteredData.filter(row => row.imp_integ_af).length
    const activatedCount = filteredData.filter(row => row.rfs_af).length
    const rfcCount = filteredData.filter(row => row.rfc_approved).length
    const hotnewsCount = filteredData.filter(row => row.hotnews_af).length
    const endorseCount = filteredData.filter(row => row.endorse_af).length
    const pacCount = filteredData.filter(row => row.pac_accepted_af).length
    
    // Hitung jumlah region_circle sebagai pengganti nano_cluster
    const uniqueClusters = new Set()
    filteredData.forEach(row => {
      if (row.region_circle) {
        uniqueClusters.add(row.region_circle)
      }
    })
    const clusterCount = uniqueClusters.size
    
    // Map data to expected format for frontend
    const mappedData = filteredData.map(row => ({
      system_key: row.system_key,
      vendor_name: row.vendor_name,
      program_report: row.program_report,
      caf_approved: row.rfi_accepted || null, // Map rfi_accepted to caf_approved (for backward compatibility)
      mos_af: row.mos_af || null,
      ic_000040_af: row.ic_000010_af || null, // Map ic_000010_af to ic_000040_af (for backward compatibility)
      ic_000010_af: row.ic_000010_af || null, // RFI header for AOP
      rfi_accepted: row.rfi_accepted || null, // CRFI for AOP
      imp_integ_af: row.imp_integ_af || null,
      rfs_bf: row.rfs_bf || null, // Baseline
      rfs_ff: row.rfs_ff || null, // Forecast
      rfs_af: row.rfs_af || null, // Actual (Activated)
      rfc_approved: row.rfc_approved || null,
      ran_score: row.ran_score || null,
      hotnews_af: row.hotnews_af || null,
      endorse_af: row.endorse_af || null,
      pac_accepted_af: row.pac_accepted_af || null,
      site_id: row.site_id || null,
      site_name: row.site_name || null,
      lat: row.latitude || null,
      long: row.longitude || null,
      imp_ttp: row.region || null, // Use region as imp_ttp equivalent
      nano_cluster: row.region_circle || null, // Use region_circle as nano_cluster equivalent
      region_circle: row.region_circle || null // Keep original region_circle for direct access
    }))
    
    return NextResponse.json({
      status: 'success',
      data: mappedData,
      count: mappedData.length,
      stats: {
        totalSites: mappedData.length,
        caf: cafCount,
        mos: mosCount,
        install: installCount,
        readiness: readinessCount,
        activated: activatedCount,
        rfc: rfcCount,
        hotnews: hotnewsCount,
        endorse: endorseCount,
        pac: pacCount,
        nanoClusters: clusterCount
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Error in AOP site-data API route:', error)
    return NextResponse.json(
      { 
        status: 'error', 
        message: error instanceof Error ? error.message : 'Internal server error',
        data: [],
        count: 0,
        stats: {
          totalSites: 0,
          caf: 0,
          mos: 0,
          install: 0,
          readiness: 0,
          activated: 0,
          rfc: 0,
          hotnews: 0,
          endorse: 0,
          pac: 0,
          nanoClusters: 0
        }
      },
      { status: 500 }
    )
  }
}

