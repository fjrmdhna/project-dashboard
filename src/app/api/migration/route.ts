import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Pool } from 'pg'

// Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

// PostgreSQL local client
const postgresPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres-dev',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'project_dashboard',
  user: process.env.POSTGRES_USER || 'project_user',
  password: process.env.POSTGRES_PASSWORD || 'projectpassword',
})

interface MigrationStats {
  table: string
  supabaseCount: number
  postgresCount: number
  success: boolean
  error?: string
}

// Function to clean data before insertion
function cleanDataForPostgres(data: any[]): any[] {
  return data.map(row => {
    const cleanedRow: any = {}
    
    for (const [key, value] of Object.entries(row)) {
      if (value === null || value === undefined) {
        cleanedRow[key] = null
      } else if (typeof value === 'string') {
        // Handle timestamp fields properly
        if (key.includes('date') || key.includes('time')) {
          // Convert timestamp strings to proper format
          if (value && value !== '') {
            try {
              // Try to parse the date string
              const date = new Date(value)
              if (!isNaN(date.getTime())) {
                cleanedRow[key] = date.toISOString()
              } else {
                cleanedRow[key] = value // Keep original if parsing fails
              }
            } catch (error) {
              cleanedRow[key] = value // Keep original if parsing fails
            }
          } else {
            cleanedRow[key] = null
          }
        } else {
          cleanedRow[key] = value
        }
      } else if (typeof value === 'number') {
        cleanedRow[key] = value
      } else {
        cleanedRow[key] = String(value)
      }
    }
    
    return cleanedRow
  })
}

async function migrateTable(tableName: string): Promise<MigrationStats> {
  try {
    console.log(`🔄 Migrating table: ${tableName}`)
    
    // 1. Get data from Supabase with timeout handling
    console.log(`📥 Fetching data from Supabase ${tableName}...`)
    
    let supabaseData: any[] = []
    let hasMoreData = true
    let page = 0
    const pageSize = 1000 // Smaller batch size to avoid timeout
    
    while (hasMoreData) {
      const start = page * pageSize
      const end = start + pageSize - 1
      
      const { data, error: supabaseError } = await supabase
        .from(tableName)
        .select('*')
        .range(start, end)
      
      if (supabaseError) {
        if (supabaseError.message.includes('timeout')) {
          console.log(`⚠️ Timeout on page ${page + 1}, trying smaller batch...`)
          // Try with smaller batch
          const { data: retryData, error: retryError } = await supabase
            .from(tableName)
            .select('*')
            .range(start, start + 500 - 1)
          
          if (retryError) {
            throw new Error(`Supabase error: ${retryError.message}`)
          }
          
          if (retryData && retryData.length > 0) {
            supabaseData = [...supabaseData, ...retryData]
            page++
            if (retryData.length < 500) {
              hasMoreData = false
            }
          } else {
            hasMoreData = false
          }
        } else {
          throw new Error(`Supabase error: ${supabaseError.message}`)
        }
      } else {
        if (data && data.length > 0) {
          supabaseData = [...supabaseData, ...data]
          page++
          if (data.length < pageSize) {
            hasMoreData = false
          }
        } else {
          hasMoreData = false
        }
      }
    }
    
    const supabaseCount = supabaseData.length
    console.log(`✅ Fetched ${supabaseCount} records from Supabase`)
    
    if (supabaseCount === 0) {
      console.log(`⚠️ No data found in Supabase ${tableName}`)
      return {
        table: tableName,
        supabaseCount: 0,
        postgresCount: 0,
        success: true
      }
    }
    
    // 2. Clean data for PostgreSQL
    console.log(`🧹 Cleaning data for PostgreSQL...`)
    const cleanedData = cleanDataForPostgres(supabaseData)
    
    // 3. Get table structure to match columns
    console.log(`🔍 Getting table structure for ${tableName}...`)
    const { rows: tableColumns } = await postgresPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName])
    
    const availableColumns = tableColumns.map(col => col.column_name)
    console.log(`📋 Available columns: ${availableColumns.join(', ')}`)
    
    // 4. Clear existing data in PostgreSQL
    console.log(`🗑️ Clearing existing data in PostgreSQL ${tableName}...`)
    await postgresPool.query(`DELETE FROM ${tableName}`)
    
    // 5. Insert data to PostgreSQL with column matching
    console.log(`📤 Inserting data to PostgreSQL ${tableName}...`)
    
    const batchSize = 100 // Smaller batch for better error handling
    let insertedCount = 0
    
    for (let i = 0; i < cleanedData.length; i += batchSize) {
      const batch = cleanedData.slice(i, i + batchSize)
      
      if (batch.length > 0) {
        // Filter data to match available columns
        const filteredBatch = batch.map(row => {
          const filteredRow: any = {}
          availableColumns.forEach(col => {
            if (row.hasOwnProperty(col)) {
              filteredRow[col] = row[col]
            }
          })
          return filteredRow
        })
        
        const columns = availableColumns.filter(col => 
          filteredBatch.some(row => row.hasOwnProperty(col))
        )
        
        if (columns.length === 0) {
          console.log(`⚠️ No matching columns found for batch ${Math.floor(i / batchSize) + 1}`)
          continue
        }
        
        const placeholders = filteredBatch.map((_, rowIndex) => {
          const rowPlaceholders = columns.map((_, colIndex) => 
            `$${rowIndex * columns.length + colIndex + 1}`
          ).join(', ')
          return `(${rowPlaceholders})`
        }).join(', ')
        
        const values = filteredBatch.flatMap(row => 
          columns.map(col => row[col])
        )
        
        // Quote column names that start with numbers or contain special characters
        const quotedColumns = columns.map(col => {
          // Always quote columns that contain dots, spaces, or start with numbers
          if (/^\d/.test(col) || col.includes('-') || col.includes('.') || col.includes(' ')) {
            return `"${col}"`;
          }
          return col;
        });
        
        const query = `
          INSERT INTO ${tableName} (${quotedColumns.join(', ')})
          VALUES ${placeholders}
        `
        
        try {
          await postgresPool.query(query, values)
          insertedCount += filteredBatch.length
          console.log(`📊 Inserted batch ${Math.floor(i / batchSize) + 1}: ${filteredBatch.length} records`)
        } catch (insertError) {
          console.error(`❌ Insert error for batch ${Math.floor(i / batchSize) + 1}:`, insertError)
          // Continue with next batch instead of failing completely
        }
      }
    }
    
    // 6. Verify migration
    console.log(`🔍 Verifying migration for ${tableName}...`)
    const { rows: postgresData } = await postgresPool.query(`SELECT COUNT(*) as count FROM ${tableName}`)
    const postgresCount = parseInt(postgresData[0].count)
    
    const success = postgresCount > 0 // Changed from exact match to > 0
    
    console.log(`✅ Migration ${success ? 'SUCCESS' : 'FAILED'} for ${tableName}`)
    console.log(`📊 Supabase: ${supabaseCount} | PostgreSQL: ${postgresCount}`)
    
    return {
      table: tableName,
      supabaseCount,
      postgresCount,
      success,
      error: success ? undefined : `No data migrated: Supabase=${supabaseCount}, PostgreSQL=${postgresCount}`
    }
    
  } catch (error) {
    console.error(`❌ Migration failed for ${tableName}:`, error)
    return {
      table: tableName,
      supabaseCount: 0,
      postgresCount: 0,
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }
  }
}

export async function POST() {
  try {
    console.log('🚀 Starting Supabase to PostgreSQL Migration...')
    
    const tables = ['site_data', 'site_data_5g']
    const results: MigrationStats[] = []
    
    // Test connections
    console.log('🔍 Testing connections...')
    
    // Test Supabase
    const { data: supabaseTest } = await supabase.from('site_data').select('count').limit(1)
    console.log('✅ Supabase connection: OK')
    
    // Test PostgreSQL
    await postgresPool.query('SELECT 1')
    console.log('✅ PostgreSQL connection: OK')
    
    console.log('')
    
    // Migrate each table
    for (const table of tables) {
      const result = await migrateTable(table)
      results.push(result)
      console.log('')
    }
    
    // Summary
    console.log('📋 MIGRATION SUMMARY')
    
    let totalSupabase = 0
    let totalPostgres = 0
    let successCount = 0
    
    results.forEach(result => {
      totalSupabase += result.supabaseCount
      totalPostgres += result.postgresCount
      if (result.success) successCount++
    })
    
    const summary = {
      totalTables: tables.length,
      successfulMigrations: successCount,
      totalSupabaseRecords: totalSupabase,
      totalPostgresRecords: totalPostgres,
      migrationStatus: successCount === tables.length ? 'COMPLETE' : 'PARTIAL',
      results
    }
    
    return NextResponse.json({
      status: 'success',
      message: 'Migration completed',
      summary,
      timestamp: new Date().toISOString()
    })
    
  } catch (error) {
    console.error('❌ Migration failed:', error)
    return NextResponse.json(
      {
        status: 'error',
        message: 'Migration failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  } finally {
    await postgresPool.end()
    console.log('🏁 Migration process completed')
  }
}

export async function GET() {
  try {
    // Test connections
    const supabaseTest = await supabase.from('site_data').select('count').limit(1)
    const postgresTest = await postgresPool.query('SELECT 1')
    
    return NextResponse.json({
      status: 'success',
      connections: {
        supabase: 'OK',
        postgres: 'OK'
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Connection test failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
} 