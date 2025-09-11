import { NextRequest, NextResponse } from 'next/server';
import { getTop5IssueData } from '@/lib/hermes-5g-utils';
import { Pool } from 'pg';

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

// Warna untuk kategori issue
const ISSUE_COLORS = [
  '#F6C945', // Kuning
  '#E74C3C', // Merah
  '#8A5AA3', // Ungu
  '#7CB342', // Hijau
  '#4AA3DF', // Biru
];

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse filter parameters
    const vendorFilter = searchParams.get('vendorFilter') || 'all';
    const programFilter = searchParams.get('programFilter') || 'all';
    const cityFilter = searchParams.get('cityFilter') || 'all';
    const searchFilter = searchParams.get('searchFilter') || '';
    
    // Build WHERE clause for filters
    const whereConditions: string[] = ['issue_category IS NOT NULL', `issue_category != ''`];
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // Add search filter
    if (searchFilter) {
      whereConditions.push(`(
        LOWER(system_key) LIKE LOWER($${paramIndex}) OR
        LOWER(site_id) LIKE LOWER($${paramIndex}) OR
        LOWER(site_name) LIKE LOWER($${paramIndex}) OR
        LOWER(vendor_name) LIKE LOWER($${paramIndex}) OR
        LOWER(issue_category) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${searchFilter}%`);
      paramIndex++;
    }
    
    // Add vendor filter
    if (vendorFilter && vendorFilter !== 'all') {
      whereConditions.push(`vendor_name = $${paramIndex}`);
      queryParams.push(vendorFilter);
      paramIndex++;
    }
    
    // Add program filter
    if (programFilter && programFilter !== 'all') {
      whereConditions.push(`program_report = $${paramIndex}`);
      queryParams.push(programFilter);
      paramIndex++;
    }
    
    // Add city filter
    if (cityFilter && cityFilter !== 'all') {
      whereConditions.push(`imp_ttp = $${paramIndex}`);
      queryParams.push(cityFilter);
      paramIndex++;
    }
    
    // Finalize WHERE clause
    const whereClause = `WHERE ${whereConditions.join(' AND ')}`;
    
    // Get top 5 issue categories by count
    const query = `
      SELECT 
        issue_category as category,
        COUNT(*) as count
      FROM site_data_5g 
      ${whereClause}
      GROUP BY issue_category 
      ORDER BY count DESC 
      LIMIT 5
    `;
    
    // Get total count of all issues
    const totalQuery = `
      SELECT COUNT(*) as total
      FROM site_data_5g 
      ${whereClause}
    `;
    
    // Execute queries
    const client = await postgresPool.connect();
    
    try {
      const result = await client.query(query, queryParams);
      const totalResult = await client.query(totalQuery, queryParams);
      
      // Process the results
      const totalCount = parseInt(totalResult.rows[0].total || '0');
      
      // Add colors to the data
      const data = result.rows.map((row, index) => ({
        category: row.category,
        count: parseInt(row.count),
        color: ISSUE_COLORS[index % ISSUE_COLORS.length]
      }));
      
      // Calculate top 5 count
      const top5Count = data.reduce((sum, item) => sum + item.count, 0);
      
      return NextResponse.json({
        status: 'success',
        data,
        top5Count,
        totalCount,
        timestamp: new Date().toISOString()
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error fetching top 5 issue data:', error);
    return NextResponse.json(
      {
        status: 'error',
        message: 'Failed to fetch top 5 issue data',
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
} 