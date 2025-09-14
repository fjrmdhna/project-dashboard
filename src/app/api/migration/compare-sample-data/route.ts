import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://opecotutdvtahsccpqzr.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9wZWNvdHV0ZHZ0YWhzY2NwcXpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzU1NDU4OTcsImV4cCI6MjA1MTEyMTg5N30.sptjTg-0L1lCep8S_wriw3ixm_sXiTAFX-JiPOQFAEU'
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
    const limit = parseInt(searchParams.get('limit') || '5')
    
    console.log(`🔍 Comparing sample data for: ${tableName} (limit: ${limit})`)
    
    // Get Supabase sample data
    const { data: supabaseData, error: supabaseError } = await supabase
      .from(tableName)
      .select('*')
      .limit(limit)
    
    if (supabaseError) {
      throw new Error(`Supabase error: ${supabaseError.message}`)
    }
    
    // Get PostgreSQL sample data
    const postgresResult = await postgresPool.query(
      `SELECT * FROM ${tableName} LIMIT $1`,
      [limit]
    )
    
    const postgresData = postgresResult.rows
    
    // Compare data structure and values
    const comparison = {
      totalSupabaseRecords: supabaseData?.length || 0,
      totalPostgresRecords: postgresData?.length || 0,
      matchingRecords: 0,
      differentRecords: 0,
      missingInPostgres: 0,
      missingInSupabase: 0
    }
    
    // Detailed comparison for each record
    const detailedComparison = []
    
    if (supabaseData && postgresData) {
      for (let i = 0; i < Math.max(supabaseData.length, postgresData.length); i++) {
        const supabaseRecord = supabaseData[i]
        const postgresRecord = postgresData[i]
        
        if (supabaseRecord && postgresRecord) {
          // Compare by system_key if available
          const supabaseKey = supabaseRecord.system_key || supabaseRecord.id
          const postgresKey = postgresRecord.system_key || postgresRecord.id
          
          if (supabaseKey === postgresKey) {
            comparison.matchingRecords++
            
            // Check for differences in values
            const differences = []
            const allKeys = [...new Set([...Object.keys(supabaseRecord), ...Object.keys(postgresRecord)])]
            
            for (const key of allKeys) {
              const supabaseValue = supabaseRecord[key]
              const postgresValue = postgresRecord[key]
              
              if (supabaseValue !== postgresValue) {
                differences.push({
                  field: key,
                  supabase: supabaseValue,
                  postgres: postgresValue
                })
              }
            }
            
            detailedComparison.push({
              recordIndex: i,
              systemKey: supabaseKey,
              status: 'MATCH',
              differences: differences.length > 0 ? differences : null
            })
          } else {
            comparison.differentRecords++
            detailedComparison.push({
              recordIndex: i,
              supabaseKey,
              postgresKey,
              status: 'DIFFERENT_KEYS'
            })
          }
        } else if (supabaseRecord && !postgresRecord) {
          comparison.missingInPostgres++
          detailedComparison.push({
            recordIndex: i,
            supabaseKey: supabaseRecord.system_key || supabaseRecord.id,
            status: 'MISSING_IN_POSTGRES'
          })
        } else if (!supabaseRecord && postgresRecord) {
          comparison.missingInSupabase++
          detailedComparison.push({
            recordIndex: i,
            postgresKey: postgresRecord.system_key || postgresRecord.id,
            status: 'MISSING_IN_SUPABASE'
          })
        }
      }
    }
    
    return NextResponse.json({
      status: 'success',
      data: {
        tableName,
        limit,
        comparison,
        detailedComparison,
        supabaseSampleData: supabaseData,
        postgresSampleData: postgresData
      },
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Compare sample data failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Compare sample data failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  } finally {
    await postgresPool.end()
  }
} 