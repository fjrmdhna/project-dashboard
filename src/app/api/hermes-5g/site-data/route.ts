import { NextRequest, NextResponse } from 'next/server'
import { Pool } from 'pg'

// PostgreSQL Pool
const postgresPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'project_dashboard',
  user: process.env.POSTGRES_USER || 'project_user',
  password: process.env.POSTGRES_PASSWORD || 'projectpassword',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    
    // Parse query parameters untuk filter
    const q = searchParams.get('q') || ''
    const vendorNames = searchParams.getAll('vendor_name') || []
    const programReports = searchParams.getAll('program_report') || []
    const impTtps = searchParams.getAll('imp_ttp') || []
    
    // Prepare query dan parameter
    let queryParams: any[] = []
    let paramIndex = 1
    let whereConditions: string[] = []
    
    // Search filter (q)
    if (q) {
      whereConditions.push(`(
        LOWER(system_key) LIKE LOWER($${paramIndex}) OR
        LOWER(site_id) LIKE LOWER($${paramIndex}) OR
        LOWER(site_name) LIKE LOWER($${paramIndex}) OR
        LOWER(vendor_name) LIKE LOWER($${paramIndex})
      )`)
      queryParams.push(`%${q}%`)
      paramIndex++
    }
    
    // Vendor name filter
    if (vendorNames.length > 0) {
      const placeholders = vendorNames.map((_, idx) => `$${paramIndex + idx}`).join(',')
      whereConditions.push(`vendor_name IN (${placeholders})`)
      queryParams.push(...vendorNames)
      paramIndex += vendorNames.length
    }
    
    // Program report filter
    if (programReports.length > 0) {
      const placeholders = programReports.map((_, idx) => `$${paramIndex + idx}`).join(',')
      whereConditions.push(`program_report IN (${placeholders})`)
      queryParams.push(...programReports)
      paramIndex += programReports.length
    }
    
    // imp_ttp filter
    if (impTtps.length > 0) {
      const placeholders = impTtps.map((_, idx) => `$${paramIndex + idx}`).join(',')
      whereConditions.push(`imp_ttp IN (${placeholders})`)
      queryParams.push(...impTtps)
      paramIndex += impTtps.length
    }
    
    // Build WHERE clause
    const whereClause = whereConditions.length > 0 
      ? `WHERE ${whereConditions.join(' AND ')}` 
      : ''
    
    // Limit jumlah data untuk performa (tingkatkan ke 10000 untuk memastikan semua data diambil)
    const limit = 10000
    
    // Query database
    const client = await postgresPool.connect()
    
    try {
      // Hitung total data sebelum limit
      const countQuery = `
        SELECT COUNT(*) as total_count
        FROM site_data_5g
        ${whereClause}
      `
      const countResult = await client.query(countQuery, queryParams)
      const totalCount = parseInt(countResult.rows[0].total_count || '0')
      
      // Query untuk data utama
      const query = `
        SELECT 
          system_key,
          vendor_name,
          program_report,
          imp_ttp,
          nano_cluster,
          caf_approved,
          mos_af,
          ic_000040_af,
          imp_integ_af,
          rfs_af,
          rfs_forecast_lock,
          hotnews_af,
          endorse_af
        FROM site_data_5g
        ${whereClause}
        LIMIT ${limit}
      `
      
      const result = await client.query(query, queryParams)
      
      // Hitung jumlah untuk masing-masing metrik
      const cafCount = result.rows.filter(row => row.caf_approved).length
      const mosCount = result.rows.filter(row => row.mos_af).length
      const installCount = result.rows.filter(row => row.ic_000040_af).length
      const readinessCount = result.rows.filter(row => row.imp_integ_af).length
      const activatedCount = result.rows.filter(row => row.rfs_af).length
      const hotnewsCount = result.rows.filter(row => row.hotnews_af).length
      const endorseCount = result.rows.filter(row => row.endorse_af).length
      
      // Hitung jumlah nano cluster
      const uniqueClusters = new Set()
      result.rows.forEach(row => {
        if (row.nano_cluster) {
          uniqueClusters.add(row.nano_cluster)
        }
      })
      const clusterCount = uniqueClusters.size
      
      // Log untuk debugging
      console.log('Data counts:', {
        total: result.rowCount,
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
        data: result.rows,
        timestamp: new Date().toISOString(),
        filtered: whereConditions.length > 0,
        count: result.rowCount,
        totalCount,
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
    } finally {
      client.release()
    }
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