import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { format, subDays } from 'date-fns';

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
});

// Interface untuk date record
interface DateRecord {
  date: Date;
  formatted: string;
  sqlDate: string;
}

// Interface untuk map hasil query
interface DataCountMap {
  [key: string]: number;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filter parameters
    const vendorFilter = searchParams.get('vendorFilter') || 'all';
    const programFilter = searchParams.get('programFilter') || 'all';
    const cityFilter = searchParams.get('cityFilter') || 'all';
    const searchFilter = searchParams.get('searchFilter') || '';
    
    // Generate dates for the last 7 days
    const today = new Date();
    const dates: DateRecord[] = Array.from({ length: 7 }, (_, i) => {
      const date = subDays(today, 6 - i);
      return {
        date,
        formatted: format(date, 'dd-MMM-yy'),
        sqlDate: format(date, 'yyyy-MM-dd')
      };
    });
    
    // Get client connection
    const client = await postgresPool.connect();
    
    try {
      // Membangun array kondisi filter dasar
      const baseWhereConditions: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;
      
      // Menambahkan filter berdasarkan parameter yang diterima
      if (searchFilter) {
        baseWhereConditions.push(`(
          LOWER(system_key) LIKE LOWER($${paramIndex}) OR
          LOWER(site_id) LIKE LOWER($${paramIndex}) OR
          LOWER(site_name) LIKE LOWER($${paramIndex}) OR
          LOWER(vendor_name) LIKE LOWER($${paramIndex})
        )`);
        queryParams.push(`%${searchFilter}%`);
        paramIndex++;
      }
      
      if (vendorFilter && vendorFilter !== 'all') {
        baseWhereConditions.push(`vendor_name = $${paramIndex}`);
        queryParams.push(vendorFilter);
        paramIndex++;
      }
      
      if (programFilter && programFilter !== 'all') {
        baseWhereConditions.push(`program_report = $${paramIndex}`);
        queryParams.push(programFilter);
        paramIndex++;
      }
      
      if (cityFilter && cityFilter !== 'all') {
        baseWhereConditions.push(`imp_ttp = $${paramIndex}`);
        queryParams.push(cityFilter);
        paramIndex++;
      }
      
      // Menggunakan pendekatan yang lebih efisien
      // Daripada menjalankan query untuk setiap hari, kita akan menjalankan satu query
      // dan kemudian memproses hasilnya
      
      let sqlQuery = `
        SELECT 
          DATE(imp_integ_af) as readiness_date,
          COUNT(*) as readiness_count
        FROM 
          site_data_5g
      `;
      
      // Membangun WHERE clause lengkap
      let whereClause = "";
      if (baseWhereConditions.length > 0) {
        whereClause = `WHERE ${baseWhereConditions.join(' AND ')}`;
      }
      
      sqlQuery += `
        ${whereClause}
        ${whereClause ? "AND" : "WHERE"} imp_integ_af IS NOT NULL
        AND DATE(imp_integ_af) >= $${paramIndex}
        AND DATE(imp_integ_af) <= $${paramIndex + 1}
        GROUP BY DATE(imp_integ_af)
      `;
      
      // Tambahkan rentang tanggal sebagai parameter
      const startDate = format(dates[0].date, 'yyyy-MM-dd');
      const endDate = format(dates[dates.length - 1].date, 'yyyy-MM-dd');
      queryParams.push(startDate, endDate);
      
      // Query untuk readiness data
      const readinessResult = await client.query(sqlQuery, queryParams);
      
      // Map readiness data ke struktur yang sesuai
      const readinessMap: DataCountMap = {};
      readinessResult.rows.forEach(row => {
        const dateKey = format(new Date(row.readiness_date), 'yyyy-MM-dd');
        readinessMap[dateKey] = parseInt(row.readiness_count);
      });
      
      // Query serupa untuk activated data
      let activatedQueryParams = [...queryParams.slice(0, paramIndex - 1)]; // Salin parameter dasar
      
      let activatedQuery = `
        SELECT 
          DATE(rfs_af) as activated_date,
          COUNT(*) as activated_count
        FROM 
          site_data_5g
      `;
      
      // Membangun WHERE clause lengkap untuk activated query
      activatedQuery += `
        ${whereClause}
        ${whereClause ? "AND" : "WHERE"} rfs_af IS NOT NULL
        AND DATE(rfs_af) >= $${paramIndex}
        AND DATE(rfs_af) <= $${paramIndex + 1}
        GROUP BY DATE(rfs_af)
      `;
      
      activatedQueryParams.push(startDate, endDate);
      
      // Query untuk activated data
      const activatedResult = await client.query(activatedQuery, activatedQueryParams);
      
      // Map activated data ke struktur yang sesuai
      const activatedMap: DataCountMap = {};
      activatedResult.rows.forEach(row => {
        const dateKey = format(new Date(row.activated_date), 'yyyy-MM-dd');
        activatedMap[dateKey] = parseInt(row.activated_count);
      });
      
      // Gabungkan data untuk setiap tanggal, selalu gunakan nilai 0 jika tidak ada data
      const dailyData = dates.map(({ date, formatted, sqlDate }) => {
        const sqlDateStr = format(date, 'yyyy-MM-dd');
        return {
          date: formatted,
          readiness: readinessMap[sqlDateStr] || 0,
          activated: activatedMap[sqlDateStr] || 0
        };
      });

      console.log("API returned data:", dailyData);
      
      return NextResponse.json({
        status: 'success',
        data: dailyData,
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      console.error("SQL Error:", err);
      // Kembalikan data dengan nilai 0 untuk semua hari, bukan data dummy random
      const emptyData = dates.map(({ formatted }) => ({
        date: formatted,
        readiness: 0,
        activated: 0
      }));
      
      return NextResponse.json({
        status: 'success',
        data: emptyData,
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching daily runrate data:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch daily runrate data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 