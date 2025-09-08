import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// PostgreSQL local client
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
    const tableName = searchParams.get('table') || 'site_data_5g'
    
    console.log(`🔍 Comparing table structure for: ${tableName}`)
    
    // Get Supabase table structure (sample data to see columns)
    const { data: supabaseData, error: supabaseError } = await supabase
      .from(tableName)
      .select('*')
      .limit(1)
    
    if (supabaseError) {
      throw new Error(`Supabase error: ${supabaseError.message}`)
    }
    
    // Get PostgreSQL table structure
    const postgresResult = await postgresPool.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName])
    
    // Extract column names from Supabase sample data
    const supabaseColumns = supabaseData && supabaseData.length > 0 
      ? Object.keys(supabaseData[0]).sort()
      : []
    
    // Extract column names from PostgreSQL schema
    const postgresColumns = postgresResult.rows.map(row => row.column_name).sort()
    
    // Compare columns
    const missingInPostgres = supabaseColumns.filter(col => !postgresColumns.includes(col))
    const missingInSupabase = postgresColumns.filter(col => !supabaseColumns.includes(col))
    const commonColumns = supabaseColumns.filter(col => postgresColumns.includes(col))
    
    // Get detailed column info for PostgreSQL
    const postgresColumnDetails = postgresResult.rows.map(row => ({
      column_name: row.column_name,
      data_type: row.data_type,
      is_nullable: row.is_nullable,
      column_default: row.column_default
    }))
    
    return NextResponse.json({
      status: 'success',
      data: {
        tableName,
        comparison: {
          totalSupabaseColumns: supabaseColumns.length,
          totalPostgresColumns: postgresColumns.length,
          commonColumnsCount: commonColumns.length,
          missingInPostgres,
          missingInSupabase,
          commonColumns
        },
        supabaseColumns,
        postgresColumns,
        postgresColumnDetails,
        supabaseSampleData: supabaseData?.[0] || null
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Compare structure failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Compare structure failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  } finally {
    await postgresPool.end()
  }
} 