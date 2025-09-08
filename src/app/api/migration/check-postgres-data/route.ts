import { NextResponse } from 'next/server'
import { Pool } from 'pg'

// PostgreSQL local client - create new pool for each request
function createPostgresPool() {
  return new Pool({
    host: process.env.POSTGRES_HOST || 'postgres-dev',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'project_dashboard',
    user: process.env.POSTGRES_USER || 'project_user',
    password: process.env.POSTGRES_PASSWORD || 'projectpassword',
  })
}

export async function GET(request: Request) {
  const postgresPool = createPostgresPool()
  
  try {
    const { searchParams } = new URL(request.url)
    const programFilter = searchParams.get('programFilter')
    
    console.log(`🔍 Checking PostgreSQL data for program: ${programFilter}`)
    
    let query = 'SELECT * FROM site_data_5g'
    let countQuery = 'SELECT COUNT(*) FROM site_data_5g'
    let params: string[] = []
    
    if (programFilter && programFilter !== 'all') {
      query += ' WHERE program_report = $1'
      countQuery += ' WHERE program_report = $1'
      params = [programFilter]
    }
    
    // Get count
    const countResult = await postgresPool.query(countQuery, params)
    const totalCount = parseInt(countResult.rows[0].count)
    
    // Get sample data
    const dataResult = await postgresPool.query(query + ' LIMIT 3', params)
    const sampleData = dataResult.rows
    
    // Get unique program_report values with counts
    const programsResult = await postgresPool.query(
      'SELECT program_report, COUNT(*) as count FROM site_data_5g WHERE program_report IS NOT NULL GROUP BY program_report'
    )
    
    const programCounts: { [key: string]: number } = {}
    programsResult.rows.forEach(row => {
      if (row.program_report) {
        programCounts[row.program_report] = parseInt(row.count)
      }
    })
    
    const uniquePrograms = Object.entries(programCounts).map(([program, count]) => `${program} : ${count} sites`)
    
    return NextResponse.json({
      status: 'success',
      data: {
        totalCount,
        sampleData,
        uniquePrograms,
        programFilter,
        hasData: totalCount > 0,
        rawCount: sampleData.length
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Check PostgreSQL data failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Check PostgreSQL data failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  } finally {
    await postgresPool.end()
  }
} 