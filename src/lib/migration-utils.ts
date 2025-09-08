import { createClient } from '@supabase/supabase-js';
import { Pool } from 'pg';

// Supabase Client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

// PostgreSQL Pool
export const postgresPool = new Pool({
  host: process.env.POSTGRES_HOST || 'postgres',
  port: parseInt(process.env.POSTGRES_PORT || '5432'),
  database: process.env.POSTGRES_DB || 'project_dashboard',
  user: process.env.POSTGRES_USER || 'project_user',
  password: process.env.POSTGRES_PASSWORD || 'projectpassword',
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Migration Configuration
export const MIGRATION_CONFIG = {
  batchSize: parseInt(process.env.MIGRATION_BATCH_SIZE || '100'),
  timeout: parseInt(process.env.MIGRATION_TIMEOUT || '30000'),
  maxRetries: 3,
};

// Utility Functions
export async function testSupabaseConnection() {
  try {
    const { data, error } = await supabase.from('site_data').select('count').limit(1);
    if (error) throw error;
    return { success: true, message: 'Supabase connection successful' };
  } catch (error) {
    return { success: false, message: `Supabase connection failed: ${error}` };
  }
}

export async function testPostgresConnection() {
  try {
    const client = await postgresPool.connect();
    const result = await client.query('SELECT 1 as test');
    client.release();
    return { success: true, message: 'PostgreSQL connection successful' };
  } catch (error) {
    return { success: false, message: `PostgreSQL connection failed: ${error}` };
  }
}

export async function getPostgresColumns(tableName: string): Promise<string[]> {
  try {
    const client = await postgresPool.connect();
    const result = await client.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = $1 
      ORDER BY ordinal_position
    `, [tableName]);
    client.release();
    
    return result.rows.map(row => row.column_name);
  } catch (error) {
    console.error(`Error getting columns for ${tableName}:`, error);
    return [];
  }
}

export async function getTableCount(tableName: string, source: 'supabase' | 'postgres') {
  try {
    if (source === 'supabase') {
      const { count, error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true });
      if (error) throw error;
      return count || 0;
    } else {
      const client = await postgresPool.connect();
      const result = await client.query(`SELECT COUNT(*) FROM ${tableName}`);
      client.release();
      return parseInt(result.rows[0].count);
    }
  } catch (error) {
    console.error(`Error getting count for ${tableName}:`, error);
    return 0;
  }
}

// Data Extraction Functions
export async function extractDataFromSupabase(
  tableName: string, 
  page: number = 0, 
  batchSize: number = MIGRATION_CONFIG.batchSize
) {
  try {
    const from = page * batchSize;
    const to = from + batchSize - 1;
    
    const { data, error } = await supabase
      .from(tableName)
      .select('*')
      .range(from, to)
      .order('id', { ascending: true });
    
    if (error) throw error;
    
    return {
      success: true,
      data: data || [],
      page,
      batchSize,
      hasMore: (data?.length || 0) === batchSize
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to extract data from ${tableName}: ${error}`,
      data: [],
      page,
      batchSize,
      hasMore: false
    };
  }
}

export async function getAllDataFromSupabase(tableName: string) {
  try {
    console.log(`🔄 Extracting data from Supabase table: ${tableName}`);
    
    // Determine order column based on table structure
    let orderColumn = 'id';
    if (tableName === 'site_data_5g') {
      orderColumn = 'system_key';
    }
    
    // Use pagination to get all data
    let allData: any[] = [];
    let page = 0;
    const pageSize = 1000; // Supabase recommended page size
    let hasMore = true;
    
    while (hasMore) {
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      console.log(`📥 Fetching page ${page + 1} (records ${from + 1}-${to + 1})`);
      
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(from, to)
        .order(orderColumn, { ascending: true });
      
      if (error) {
        console.error(`❌ Supabase error for ${tableName} page ${page + 1}:`, error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      allData = allData.concat(data);
      hasMore = data.length === pageSize;
      page++;
      
      console.log(`✅ Page ${page} completed: ${data.length} records (Total: ${allData.length})`);
    }
    
    // Get PostgreSQL columns to filter data
    const postgresColumns = await getPostgresColumns(tableName);
    
    // Filter data to only include columns that exist in PostgreSQL
    const cleanedData = allData.map(row => {
      const cleanedRow: any = {};
      Object.keys(row).forEach(key => {
        if (postgresColumns.includes(key)) {
          cleanedRow[key] = row[key];
        }
      });
      return cleanedRow;
    });
    
    console.log(`🎉 Successfully extracted ${cleanedData.length} records from ${tableName} in ${page} pages`);
    
    return {
      success: true,
      data: cleanedData,
      totalRecords: cleanedData.length
    };
  } catch (error) {
    console.error(`❌ Error in getAllDataFromSupabase for ${tableName}:`, error);
    return {
      success: false,
      error: `Failed to get all data from ${tableName}: ${error instanceof Error ? error.message : String(error)}`,
      data: [],
      totalRecords: 0
    };
  }
}

// Data Insertion Functions
export async function insertDataToPostgres(
  tableName: string, 
  data: any[], 
  batchSize: number = MIGRATION_CONFIG.batchSize
) {
  if (!data || data.length === 0) {
    return { success: true, insertedCount: 0, message: 'No data to insert' };
  }

  console.log(`🔄 Starting insertion of ${data.length} records to ${tableName} with batch size ${batchSize}`);
  
  const client = await postgresPool.connect();
  
  try {
    await client.query('BEGIN');
    
    let insertedCount = 0;
    const errors: string[] = [];
    const totalBatches = Math.ceil(data.length / batchSize);
    
    // Process data in batches
    for (let i = 0; i < data.length; i += batchSize) {
      const batch = data.slice(i, i + batchSize);
      const currentBatch = Math.floor(i / batchSize) + 1;
      
      console.log(`📦 Processing batch ${currentBatch}/${totalBatches} (${batch.length} records)`);
      
      try {
        // Generate dynamic INSERT query
        const columns = Object.keys(batch[0]);
        const placeholders = batch.map((_, rowIndex) => {
          const rowPlaceholders = columns.map((_, colIndex) => 
            `$${rowIndex * columns.length + colIndex + 1}`
          );
          return `(${rowPlaceholders.join(', ')})`;
        }).join(', ');
        
        // Determine conflict column based on table structure
        let conflictColumn = 'system_key'; // Default to system_key for both tables
        if (tableName === 'site_data') {
          conflictColumn = 'system_key'; // site_data uses system_key as unique identifier
        } else if (tableName === 'site_data_5g') {
          conflictColumn = 'system_key'; // site_data_5g uses system_key as unique identifier
        }
        
        // Quote column names that start with numbers or contain special characters
        const quotedColumns = columns.map(col => {
          if (/^\d/.test(col) || col.includes('.') || col.includes('-')) {
            return `"${col}"`;
          }
          return col;
        });
        
        const quotedConflictColumn = /^\d/.test(conflictColumn) || conflictColumn.includes('.') || conflictColumn.includes('-') 
          ? `"${conflictColumn}"` 
          : conflictColumn;
        
        const query = `
          INSERT INTO ${tableName} (${quotedColumns.join(', ')})
          VALUES ${placeholders}
          ON CONFLICT (${quotedConflictColumn}) DO UPDATE SET
          ${quotedColumns.filter(col => col !== quotedConflictColumn).map(col => `${col} = EXCLUDED.${col}`).join(', ')}
        `;
        
        // Flatten data for query
        const values = batch.flatMap(row => columns.map(col => row[col]));
        
        const result = await client.query(query, values);
        insertedCount += result.rowCount || 0;
        
        console.log(`✅ Batch ${currentBatch} completed: ${result.rowCount || 0} records inserted`);
        
      } catch (batchError) {
        const errorMsg = `Batch ${currentBatch}: ${batchError}`;
        console.error(`❌ ${errorMsg}`);
        errors.push(errorMsg);
      }
    }
    
    if (errors.length > 0) {
      console.error(`❌ Insertion completed with ${errors.length} batch errors`);
      await client.query('ROLLBACK');
      return {
        success: false,
        insertedCount,
        errors,
        message: `Insertion completed with ${errors.length} batch errors`
      };
    }
    
    await client.query('COMMIT');
    console.log(`🎉 Successfully inserted ${insertedCount} records to ${tableName}`);
    
    return {
      success: true,
      insertedCount,
      message: `Successfully inserted ${insertedCount} records`
    };
    
  } catch (error) {
    console.error(`❌ Transaction failed for ${tableName}:`, error);
    await client.query('ROLLBACK');
    return {
      success: false,
      insertedCount: 0,
      error: `Transaction failed: ${error}`,
      message: 'All changes rolled back'
    };
  } finally {
    client.release();
  }
}

export async function clearTableData(tableName: string) {
  try {
    const client = await postgresPool.connect();
    const result = await client.query(`DELETE FROM ${tableName}`);
    client.release();
    
    return {
      success: true,
      deletedCount: result.rowCount || 0,
      message: `Cleared ${result.rowCount || 0} records from ${tableName}`
    };
  } catch (error) {
    return {
      success: false,
      error: `Failed to clear table ${tableName}: ${error}`,
      message: 'Table clear operation failed'
    };
  }
} 