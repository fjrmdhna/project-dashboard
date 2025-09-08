import { NextResponse } from 'next/server';
import { 
  getAllDataFromSupabase, 
  insertDataToPostgres, 
  clearTableData,
  getTableCount 
} from '@/lib/migration-utils';

export async function POST(request: Request) {
  try {
    const { tableName, clearExisting = false } = await request.json();
    
    if (!tableName || !['site_data', 'site_data_5g'].includes(tableName)) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Invalid table name. Use "site_data" or "site_data_5g"' 
        },
        { status: 400 }
      );
    }

    const timestamp = new Date().toISOString();
    
    // Step 1: Get data count from Supabase
    const supabaseCount = await getTableCount(tableName, 'supabase');
    const postgresCount = await getTableCount(tableName, 'postgres');
    
    // Step 2: Clear existing data if requested
    let clearResult = null;
    if (clearExisting) {
      clearResult = await clearTableData(tableName);
      if (!clearResult.success) {
        return NextResponse.json(
          { 
            status: 'error', 
            message: 'Failed to clear existing data',
            error: clearResult.error 
          },
          { status: 500 }
        );
      }
    }
    
    // Step 3: Extract all data from Supabase
    const extractionResult = await getAllDataFromSupabase(tableName);
    if (!extractionResult.success) {
      return NextResponse.json(
        { 
          status: 'error', 
          message: 'Failed to extract data from Supabase',
          error: extractionResult.error 
        },
        { status: 500 }
      );
    }
    
    // Step 4: Insert data to PostgreSQL
    const insertionResult = await insertDataToPostgres(tableName, extractionResult.data);
    
    // Step 5: Verify final count
    const finalPostgresCount = await getTableCount(tableName, 'postgres');
    
    return NextResponse.json({
      status: 'success',
      timestamp,
      tableName,
      migration: {
        clearExisting,
        clearResult,
        extractionResult: {
          success: extractionResult.success,
          totalRecords: extractionResult.totalRecords
        },
        insertionResult,
        verification: {
          supabaseCount,
          postgresCountBefore: postgresCount,
          postgresCountAfter: finalPostgresCount,
          recordsMigrated: insertionResult.insertedCount
        }
      },
      summary: {
        migrationSuccessful: insertionResult.success,
        totalRecordsProcessed: extractionResult.totalRecords,
        recordsMigrated: insertionResult.insertedCount,
        errors: insertionResult.errors || []
      }
    });
    
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: 'Migration failed',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 