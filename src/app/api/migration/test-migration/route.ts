import { NextResponse } from 'next/server';
import { 
  getAllDataFromSupabase, 
  insertDataToPostgres, 
  getTableCount,
  supabase
} from '@/lib/migration-utils';

export async function GET() {
  try {
    const timestamp = new Date().toISOString();
    
    // Test with site_data_5g (smaller table)
    const tableName = 'site_data_5g';
    
    // Get counts
    const supabaseCount = await getTableCount(tableName, 'supabase');
    const postgresCount = await getTableCount(tableName, 'postgres');
    
    // Extract sample data (first 10 records)
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .limit(10);
    
    if (error) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Failed to extract sample data',
          error: error.message 
        },
        { status: 500 }
      );
    }
    
    return NextResponse.json({
      status: 'success',
      timestamp,
      tableName,
      counts: {
        supabase: supabaseCount,
        postgres: postgresCount
      },
      sampleData: {
        recordCount: data?.length || 0,
        firstRecord: data?.[0] || null,
        columns: data?.[0] ? Object.keys(data[0]) : []
      },
      message: 'Test migration endpoint working correctly'
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Test migration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 