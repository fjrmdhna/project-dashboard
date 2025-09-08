import { NextResponse } from 'next/server';
import { testSupabaseConnection, testPostgresConnection, getTableCount } from '@/lib/migration-utils';

export async function GET() {
  try {
    const timestamp = new Date().toISOString();
    
    // Test Supabase Connection
    const supabaseTest = await testSupabaseConnection();
    
    // Test PostgreSQL Connection
    const postgresTest = await testPostgresConnection();
    
    // Get table counts
    const supabaseSiteDataCount = await getTableCount('site_data', 'supabase');
    const supabaseSiteData5gCount = await getTableCount('site_data_5g', 'supabase');
    const postgresSiteDataCount = await getTableCount('site_data', 'postgres');
    const postgresSiteData5gCount = await getTableCount('site_data_5g', 'postgres');
    
    return NextResponse.json({
      status: 'success',
      timestamp,
      connections: {
        supabase: supabaseTest,
        postgres: postgresTest,
      },
      tableCounts: {
        supabase: {
          site_data: supabaseSiteDataCount,
          site_data_5g: supabaseSiteData5gCount,
        },
        postgres: {
          site_data: postgresSiteDataCount,
          site_data_5g: postgresSiteData5gCount,
        },
      },
      summary: {
        supabaseReady: supabaseTest.success,
        postgresReady: postgresTest.success,
        migrationReady: supabaseTest.success && postgresTest.success,
      }
    });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Connection test failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 