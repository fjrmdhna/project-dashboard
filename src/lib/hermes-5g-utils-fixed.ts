import { Pool } from 'pg';

// PostgreSQL Pool (reuse from migration-utils)
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

// Hermes 5G Data Interface
export interface Hermes5GData {
  system_key: string;
  site_id: string;
  site_name: string;
  vendor_name: string;
  site_status: string;
  region: string;
  year: string;
  program_name: string;
  "SBOQ.project_type": string;
  vendor_code: string;
  "5g_readiness_date": string | null;
  "5g_activation_date": string | null;
  cx_acceptance_status: string;
  long: number | null;
  lat: number | null;
  created_at: string;
  site_category?: string;
  scope_of_work?: string;
  region_wise?: string;
  region_circle?: string;
}

// Pagination Interface
export interface PaginationParams {
  page: number;
  pageSize: number;
  search?: string;
  statusFilter?: string;
  regionFilter?: string;
  vendorFilter?: string;
  programFilter?: string;
  cityFilter?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

// Response Interface
export interface Hermes5GResponse {
  status: 'success' | 'error';
  data: Hermes5GData[];
  pagination: {
    currentPage: number;
    pageSize: number;
    totalRecords: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
  stats: {
    total: number;
    scope: number;
    caf: number;
    mos: number;
    installation: number;
    fiveGReadiness: number;
    fiveGActivation: number;
    rfc: number;
    endorse: number;
    hotnews: number;
    pac: number;
    clusterAtp: number;
  };
  timestamp: string;
}

// Get Hermes 5G Statistics with filters
export async function getHermes5GStats(filters?: {
  search?: string;
  statusFilter?: string;
  regionFilter?: string;
  vendorFilter?: string;
  programFilter?: string;
  cityFilter?: string;
}) {
  try {
    const client = await postgresPool.connect();
    
    // Build WHERE clause for stats
    const whereConditions: string[] = [];
    const queryParams: any[] = [];
    let paramIndex = 1;
    
    // Search filter
    if (filters?.search) {
      whereConditions.push(`(
        LOWER(site_name) LIKE LOWER($${paramIndex}) OR 
        LOWER(site_id) LIKE LOWER($${paramIndex}) OR 
        LOWER(vendor_name) LIKE LOWER($${paramIndex}) OR
        LOWER(system_key) LIKE LOWER($${paramIndex})
      )`);
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    // Status filter
    if (filters?.statusFilter && filters.statusFilter !== 'all') {
      whereConditions.push(`LOWER(site_status) = LOWER($${paramIndex})`);
      queryParams.push(filters.statusFilter);
      paramIndex++;
    }
    
    // Region filter
    if (filters?.regionFilter && filters.regionFilter !== 'all') {
      whereConditions.push(`region = $${paramIndex}`);
      queryParams.push(filters.regionFilter);
      paramIndex++;
    }
    
    // Vendor filter
    if (filters?.vendorFilter && filters.vendorFilter !== 'all') {
      whereConditions.push(`LOWER(vendor_code) = LOWER($${paramIndex})`);
      queryParams.push(filters.vendorFilter);
      paramIndex++;
    }
    
    // Program filter
    if (filters?.programFilter && filters.programFilter !== 'all') {
      whereConditions.push(`program_report = $${paramIndex}`);
      queryParams.push(filters.programFilter);
      paramIndex++;
    }
    
    // City filter (using imp_ttp)
    if (filters?.cityFilter && filters.cityFilter !== 'all') {
      whereConditions.push(`imp_ttp = $${paramIndex}`);
      queryParams.push(filters.cityFilter);
      paramIndex++;
    }
    
    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';
    
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN system_key IS NOT NULL THEN 1 END) as scope,
        COUNT(CASE WHEN caf_approved IS NOT NULL THEN 1 END) as caf,
        COUNT(CASE WHEN mos_af IS NOT NULL THEN 1 END) as mos,
        COUNT(CASE WHEN ic_000040_af IS NOT NULL THEN 1 END) as installation,
        COUNT(CASE WHEN imp_integ_af IS NOT NULL THEN 1 END) as five_g_readiness,
        COUNT(CASE WHEN rfs_af IS NOT NULL THEN 1 END) as five_g_activation,
        COUNT(CASE WHEN rfc_approved IS NOT NULL THEN 1 END) as rfc,
        COUNT(CASE WHEN endorse_af IS NOT NULL THEN 1 END) as endorse,
        COUNT(CASE WHEN hotnews_af IS NOT NULL THEN 1 END) as hotnews,
        COUNT(CASE WHEN pac_accepted_af IS NOT NULL THEN 1 END) as pac,
        COUNT(CASE WHEN cluster_acceptance_af IS NOT NULL THEN 1 END) as cluster_atp
      FROM site_data_5g
      ${whereClause}
    `;
    
    const result = await client.query(statsQuery, queryParams);
    client.release();
    
    const row = result.rows[0];
    return {
      total: parseInt(row.total),
      scope: parseInt(row.scope),
      caf: parseInt(row.caf),
      mos: parseInt(row.mos),
      installation: parseInt(row.installation),
      fiveGReadiness: parseInt(row.five_g_readiness),
      fiveGActivation: parseInt(row.five_g_activation),
      rfc: parseInt(row.rfc),
      endorse: parseInt(row.endorse),
      hotnews: parseInt(row.hotnews),
      pac: parseInt(row.pac),
      clusterAtp: parseInt(row.cluster_atp)
    };
    
  } catch (error) {
    console.error('Error fetching Hermes 5G stats:', error);
    return {
      total: 0,
      scope: 0,
      caf: 0,
      mos: 0,
      installation: 0,
      fiveGReadiness: 0,
      fiveGActivation: 0,
      rfc: 0,
      endorse: 0,
      hotnews: 0,
      pac: 0,
      clusterAtp: 0
    };
  }
}

// Export other functions from original file
export * from './hermes-5g-utils';
