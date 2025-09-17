import { supabase } from './supabase';

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

// 5G Readiness Chart Data Interface
export interface ReadinessChartData {
  location: string;
  nyReadiness: number;
  readiness: number;
}

export interface ReadinessChartResponse {
  status: 'success' | 'error';
  data: ReadinessChartData[];
  timestamp: string;
}

// 5G Activated Chart Data Interface
export interface ActivatedChartData {
  location: string;
  nyActivated: number;
  activated: number;
}

export interface ActivatedChartResponse {
  status: 'success' | 'error';
  data: ActivatedChartData[];
  timestamp: string;
}

// Progress Curve Data Interface
export interface ProgressCurveData {
  period: string;           // "W36-Sep", "W37-Sep", "Oct", "Nov"
  forecastAccelerate: number;  // Count dari rfs_forecast_lock
  readiness: number;        // Count dari imp_integ_af NOT NULL
  activated: number;        // Count dari rfs_af NOT NULL
}

export interface ProgressCurveResponse {
  status: 'success' | 'error';
  data: ProgressCurveData[];
  timestamp: string;
}

// Daily Runrate Data Interface
export interface DailyRunrateData {
  date: string;             // "12-Sep-25", "13-Sep-25", etc.
  readiness: number;        // Count dari imp_integ_af NOT NULL
  activated: number;        // Count dari rfs_af NOT NULL
}

export interface DailyRunrateResponse {
  status: 'success' | 'error';
  data: DailyRunrateData[];
  timestamp: string;
  note?: string;
}

// Data Alignment Chart Data Interface
export interface DataAlignmentData {
  caf: number
  mos: number
  install: number
  readiness: number
  activated: number
  rfc: number
  hn: number
  endorse: number
}

export interface DataAlignmentResponse {
  status: 'success' | 'error';
  data: DataAlignmentData;
  timestamp: string;
}

// Top 5 Issue Chart Data Interface
export interface Top5IssueData {
  category: string
  count: number
  color: string
}

export interface Top5IssueResponse {
  status: 'success' | 'error';
  data: Top5IssueData[];
  top5Count: number;
  totalCount: number;
  timestamp: string;
}

// Nano Cluster Chart Data Interface
export interface NanoClusterData {
  totalClusters: number
  readinessLess50: number
  readiness50to80: number
  readiness80to99: number
  readiness100: number
  completed: number
}

export interface NanoClusterResponse {
  status: 'success' | 'error';
  data: NanoClusterData;
  timestamp: string;
}

// Filter Options Interface
export interface FilterOptionsData {
  vendors: string[]
  programs: string[]
  cities: string[]
  nanoClusters: string[]
}

export interface FilterOptionsResponse {
  status: 'success' | 'error';
  data: FilterOptionsData;
  timestamp: string;
}

// Get Hermes 5G Data with Pagination
export async function getHermes5GData(params: PaginationParams): Promise<Hermes5GResponse> {
  try {
    // Build Supabase query
    let query = supabase
      .from('site_data_5g')
      .select('*', { count: 'exact' });
    
    // Apply filters
    if (params.search) {
      query = query.or(`site_name.ilike.%${params.search}%,site_id.ilike.%${params.search}%,vendor_name.ilike.%${params.search}%,system_key.ilike.%${params.search}%`);
    }
    
    if (params.statusFilter && params.statusFilter !== 'all') {
      query = query.eq('site_status', params.statusFilter);
    }
    
    if (params.regionFilter && params.regionFilter !== 'all') {
      query = query.eq('region', params.regionFilter);
    }
    
    if (params.vendorFilter && params.vendorFilter !== 'all') {
      query = query.eq('vendor_code', params.vendorFilter);
    }
    
    // Apply pagination
    const offset = (params.page - 1) * params.pageSize;
    query = query.range(offset, offset + params.pageSize - 1);
    
    // Apply sorting
    const sortBy = params.sortBy || 'created_at';
    const sortOrder = params.sortOrder || 'desc';
    query = query.order(sortBy, { ascending: sortOrder === 'asc' });
    
    const { data, error, count } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    const totalRecords = count || 0;
    const totalPages = Math.ceil(totalRecords / params.pageSize);
    
    // Calculate stats
    const stats = await getHermes5GStats();
    
    return {
      status: 'success',
      data: data as Hermes5GData[],
      pagination: {
        currentPage: params.page,
        pageSize: params.pageSize,
        totalRecords,
        totalPages,
        hasNext: params.page < totalPages,
        hasPrev: params.page > 1
      },
      stats,
      timestamp: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error fetching Hermes 5G data:', error);
    throw error;
  }
}

// Get Hermes 5G Statistics
export async function getHermes5GStats() {
  try {
    // Get all data to calculate stats
    const { data, error } = await supabase
      .from('site_data_5g')
      .select('*');
    
    if (error) {
      console.error('Supabase Error:', error);
      throw new Error(`Supabase error: ${error.message}`);
    }
    
    if (!data) {
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
    
    // Calculate stats from data
    const total = data.length;
    const scope = data.filter(row => row.system_key).length;
    const caf = data.filter(row => row.caf_approved).length;
    const mos = data.filter(row => row.mos_af).length;
    const installation = data.filter(row => row.ic_000040_af).length;
    const fiveGReadiness = data.filter(row => row.imp_integ_af).length;
    const fiveGActivation = data.filter(row => row.rfs_af).length;
    const rfc = data.filter(row => row.rfc_approved).length;
    const endorse = data.filter(row => row.endorse_af).length;
    const hotnews = data.filter(row => row.hotnews_af).length;
    const pac = data.filter(row => row.pac_accepted_af).length;
    const clusterAtp = data.filter(row => row.cluster_acceptance_af).length;
    
    return {
      total,
      scope,
      caf,
      mos,
      installation,
      fiveGReadiness,
      fiveGActivation,
      rfc,
      endorse,
      hotnews,
      pac,
      clusterAtp
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

// Get Available Filter Options
export async function getFilterOptions(): Promise<FilterOptionsResponse> {
  try {
    // Get unique vendors from vendor_name
    const { data: vendorsData, error: vendorsError } = await supabase
      .from('site_data_5g')
      .select('vendor_name')
      .not('vendor_name', 'is', null)
      .neq('vendor_name', '');
    
    // Get unique programs from program_report
    const { data: programsData, error: programsError } = await supabase
      .from('site_data_5g')
      .select('program_report')
      .not('program_report', 'is', null)
      .neq('program_report', '');
    
    // Get unique cities from imp_ttp
    const { data: citiesData, error: citiesError } = await supabase
      .from('site_data_5g')
      .select('imp_ttp')
      .not('imp_ttp', 'is', null)
      .neq('imp_ttp', '');
    
    // Get unique nano clusters from nano_cluster
    const { data: nanoClustersData, error: nanoClustersError } = await supabase
      .from('site_data_5g')
      .select('nano_cluster')
      .not('nano_cluster', 'is', null)
      .neq('nano_cluster', '');
    
    if (vendorsError || programsError || citiesError || nanoClustersError) {
      console.error('Supabase Error:', vendorsError || programsError || citiesError || nanoClustersError);
      throw new Error(`Supabase error: ${vendorsError?.message || programsError?.message || citiesError?.message || nanoClustersError?.message}`);
    }
    
    const data: FilterOptionsData = {
      vendors: [...new Set(vendorsData?.map(row => row.vendor_name) || [])].sort(),
      programs: [...new Set(programsData?.map(row => row.program_report) || [])].sort(),
      cities: [...new Set(citiesData?.map(row => row.imp_ttp) || [])].sort(),
      nanoClusters: [...new Set(nanoClustersData?.map(row => row.nano_cluster) || [])].sort()
    };
    
    console.log('Filter options from Supabase:', data);
    
    return {
      status: 'success',
      data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting filter options:', error);
    return {
      status: 'error',
      data: {
        vendors: [],
        programs: [],
        cities: [],
        nanoClusters: []
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Get 5G Readiness Chart Data
export async function getReadinessChartData(filters?: {
  vendorNames?: string[];
  programReports?: string[];
  impTtps?: string[];
}): Promise<ReadinessChartResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('imp_ttp, imp_integ_af')
      .not('imp_ttp', 'is', null);
    
    // Apply filters (multi-value)
    if (filters?.vendorNames && filters.vendorNames.length > 0) {
      query = query.in('vendor_name', filters.vendorNames)
    }
    if (filters?.programReports && filters.programReports.length > 0) {
      query = query.in('program_report', filters.programReports)
    }
    if (filters?.impTtps && filters.impTtps.length > 0) {
      query = query.in('imp_ttp', filters.impTtps)
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // Process data to group by location
    const locationData: { [key: string]: { nyReadiness: number; readiness: number } } = {};
    
    data?.forEach(row => {
      const location = row.imp_ttp || 'Unknown';
      if (!locationData[location]) {
        locationData[location] = { nyReadiness: 0, readiness: 0 };
      }
      
      if (row.imp_integ_af === null) {
        locationData[location].nyReadiness++;
      } else {
        locationData[location].readiness++;
      }
    });
    
    // Convert to array and sort by nyReadiness
    const result = Object.entries(locationData)
      .map(([location, counts]) => ({
        location,
        nyReadiness: counts.nyReadiness,
        readiness: counts.readiness
      }))
      .sort((a, b) => b.nyReadiness - a.nyReadiness);
    
    return {
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting readiness chart data:', error);
    return {
      status: 'error',
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Get 5G Activated Chart Data
export async function getActivatedChartData(filters?: {
  vendorNames?: string[];
  programReports?: string[];
  impTtps?: string[];
}): Promise<ActivatedChartResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('imp_ttp, rfs_af')
      .not('imp_ttp', 'is', null);
    
    // Apply filters (multi-value)
    if (filters?.vendorNames && filters.vendorNames.length > 0) {
      query = query.in('vendor_name', filters.vendorNames)
    }
    if (filters?.programReports && filters.programReports.length > 0) {
      query = query.in('program_report', filters.programReports)
    }
    if (filters?.impTtps && filters.impTtps.length > 0) {
      query = query.in('imp_ttp', filters.impTtps)
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // Process data to group by location
    const locationData: { [key: string]: { nyActivated: number; activated: number } } = {};
    
    data?.forEach(row => {
      const location = row.imp_ttp || 'Unknown';
      if (!locationData[location]) {
        locationData[location] = { nyActivated: 0, activated: 0 };
      }
      
      if (row.rfs_af === null) {
        locationData[location].nyActivated++;
      } else {
        locationData[location].activated++;
      }
    });
    
    // Convert to array and sort by nyActivated
    const result = Object.entries(locationData)
      .map(([location, counts]) => ({
        location,
        nyActivated: counts.nyActivated,
        activated: counts.activated
      }))
      .sort((a, b) => b.nyActivated - a.nyActivated);
    
    return {
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting activated chart data:', error);
    return {
      status: 'error',
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Get Progress Curve Data
export async function getProgressCurveData(filters?: {
  vendorNames?: string[];
  programReports?: string[];
  impTtps?: string[];
}): Promise<ProgressCurveResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('rfs_forecast_lock, imp_integ_af, rfs_af')
      .not('rfs_forecast_lock', 'is', null);
    
    // Apply filters (multi-value)
    if (filters?.vendorNames && filters.vendorNames.length > 0) {
      query = query.in('vendor_name', filters.vendorNames)
    }
    if (filters?.programReports && filters.programReports.length > 0) {
      query = query.in('program_report', filters.programReports)
    }
    if (filters?.impTtps && filters.impTtps.length > 0) {
      query = query.in('imp_ttp', filters.impTtps)
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // Process data to group by period
    const periodData: { [key: string]: { forecastAccelerate: number; readiness: number; activated: number } } = {};
    
    data?.forEach(row => {
      if (row.rfs_forecast_lock) {
        const date = new Date(row.rfs_forecast_lock);
        const month = date.getMonth() + 1; // 1-12
        const year = date.getFullYear();
        const week = Math.ceil(date.getDate() / 7);
        
        let period = '';
        if (month === 9 && year === 2025) {
          // Weekly format for September 2025
          period = `W${week}-Sep`;
        } else {
          // Monthly format for other months
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          period = monthNames[month - 1];
        }
        
        if (!periodData[period]) {
          periodData[period] = { forecastAccelerate: 0, readiness: 0, activated: 0 };
        }
        
        periodData[period].forecastAccelerate++;
        
        if (row.imp_integ_af) {
          periodData[period].readiness++;
        }
        
        if (row.rfs_af) {
          periodData[period].activated++;
        }
      }
    });
    
    // Convert to array and sort
    const processedData: ProgressCurveData[] = Object.entries(periodData)
      .map(([period, counts]) => ({
        period,
        forecastAccelerate: counts.forecastAccelerate,
        readiness: counts.readiness,
        activated: counts.activated
      }))
      .sort((a, b) => {
        // Sort by period order
        const monthOrder = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const aIsWeekly = a.period.includes('W');
        const bIsWeekly = b.period.includes('W');
        
        if (aIsWeekly && bIsWeekly) {
          return a.period.localeCompare(b.period);
        } else if (aIsWeekly) {
          return -1;
        } else if (bIsWeekly) {
          return 1;
        } else {
          const aMonth = a.period;
          const bMonth = b.period;
          return monthOrder.indexOf(aMonth) - monthOrder.indexOf(bMonth);
        }
      });
    
    return {
      status: 'success',
      data: processedData,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting progress curve data:', error);
    return {
      status: 'error',
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Get Daily Runrate Data for Last 7 Days
export async function getDailyRunrateData(filters?: {
  vendorFilter?: string;
  programFilter?: string;
  cityFilter?: string;
}): Promise<DailyRunrateResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('imp_integ_af, rfs_af');
    
    // Apply filters
    if (filters?.vendorFilter && filters.vendorFilter !== 'all') {
      query = query.eq('vendor_name', filters.vendorFilter);
    }
    
    if (filters?.programFilter && filters.programFilter !== 'all') {
      query = query.eq('program_report', filters.programFilter);
    }
    
    if (filters?.cityFilter && filters.cityFilter !== 'all') {
      query = query.eq('imp_ttp', filters.cityFilter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: [],
        timestamp: new Date().toISOString()
      };
    }
    
    // Generate current week dates (Monday to Sunday)
    const today = new Date();
    const currentWeek = [];
    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay() + 1); // Monday
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startOfWeek);
      date.setDate(startOfWeek.getDate() + i);
      currentWeek.push(date);
    }
    
    // Process data to count readiness and activation by date
    const processedData = currentWeek.map(date => {
      const dateStr = date.toISOString().split('T')[0];
      const readiness = data?.filter(row => 
        row.imp_integ_af && row.imp_integ_af.startsWith(dateStr)
      ).length || 0;
      const activated = data?.filter(row => 
        row.rfs_af && row.rfs_af.startsWith(dateStr)
      ).length || 0;
      
      return {
        date: date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }),
        readiness,
        activated
      };
    });
    
    console.log('Daily Runrate - Current week data from Supabase:', processedData);
    
    return {
      status: 'success',
      data: processedData,
      timestamp: new Date().toISOString(),
      note: 'Full current week data (Mon-Sun)'
    };
  } catch (error) {
    console.error('Error getting daily runrate data:', error);
    return {
      status: 'error',
      data: [],
      timestamp: new Date().toISOString()
    };
  }
}

// Get Data Alignment Data
export async function getDataAlignmentData(filters?: {
  vendorNames?: string[];
  programReports?: string[];
  impTtps?: string[];
}): Promise<DataAlignmentResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('caf_approved, mos_af, ic_000040_af, imp_integ_af, rfs_af, rfc_approved, hotnews_af, endorse_af');
    
    // Apply filters (multi-value)
    if (filters?.vendorNames && filters.vendorNames.length > 0) {
      query = query.in('vendor_name', filters.vendorNames)
    }
    if (filters?.programReports && filters.programReports.length > 0) {
      query = query.in('program_report', filters.programReports)
    }
    if (filters?.impTtps && filters.impTtps.length > 0) {
      query = query.in('imp_ttp', filters.impTtps)
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: {
          caf: 0,
          mos: 0,
          install: 0,
          readiness: 0,
          activated: 0,
          rfc: 0,
          hn: 0,
          endorse: 0
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // Calculate counts from data
    const dataAlignment: DataAlignmentData = {
      caf: data?.filter(row => row.caf_approved).length || 0,
      mos: data?.filter(row => row.mos_af).length || 0,
      install: data?.filter(row => row.ic_000040_af).length || 0,
      readiness: data?.filter(row => row.imp_integ_af).length || 0,
      activated: data?.filter(row => row.rfs_af).length || 0,
      rfc: data?.filter(row => row.rfc_approved).length || 0,
      hn: data?.filter(row => row.hotnews_af).length || 0,
      endorse: data?.filter(row => row.endorse_af).length || 0
    };
    
    console.log('Data Alignment data from Supabase:', dataAlignment);
    
    return {
      status: 'success',
      data: dataAlignment,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting data alignment data:', error);
    return {
      status: 'error',
      data: {
        caf: 0,
        mos: 0,
        install: 0,
        readiness: 0,
        activated: 0,
        rfc: 0,
        hn: 0,
        endorse: 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

// Get Top 5 Issue Data
export async function getTop5IssueData(filters?: {
  vendorFilter?: string;
  programFilter?: string;
  cityFilter?: string;
}): Promise<Top5IssueResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('issue_category')
      .not('issue_category', 'is', null)
      .neq('issue_category', '');
    
    // Apply filters
    if (filters?.vendorFilter && filters.vendorFilter !== 'all') {
      query = query.eq('vendor_name', filters.vendorFilter);
    }
    
    if (filters?.programFilter && filters.programFilter !== 'all') {
      query = query.eq('program_report', filters.programFilter);
    }
    
    if (filters?.cityFilter && filters.cityFilter !== 'all') {
      query = query.eq('imp_ttp', filters.cityFilter);
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: [],
        top5Count: 0,
        totalCount: 0,
        timestamp: new Date().toISOString()
      };
    }
    
    // Count occurrences of each issue category
    const categoryCounts: { [key: string]: number } = {};
    data?.forEach(row => {
      const category = row.issue_category;
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
    });
    
    // Sort by count and get top 5
    const sortedCategories = Object.entries(categoryCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);
    
    // Define colors for segments
    const colors = ['#3B82F6', '#10B981', '#06B6D4', '#EF4444', '#8B5CF6'];
    
    // Process data with colors
    const processedData: Top5IssueData[] = sortedCategories.map(([category, count], index) => ({
      category,
      count,
      color: colors[index] || '#6B7280'
    }));
    
    // Calculate counts
    const top5Count = processedData.reduce((sum, item) => sum + item.count, 0);
    const totalCount = data?.length || 0;
    
    console.log('Top 5 Issue data from Supabase:', processedData);
    console.log('Top 5 Count:', top5Count, 'Total Count:', totalCount);
    
    return {
      status: 'success',
      data: processedData,
      top5Count,
      totalCount,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting top 5 issue data:', error);
    return {
      status: 'error',
      data: [],
      top5Count: 0,
      totalCount: 0,
      timestamp: new Date().toISOString()
    };
  }
}

// Get Nano Cluster Data
export async function getNanoClusterData(filters?: {
  vendorNames?: string[];
  programReports?: string[];
  impTtps?: string[];
}): Promise<NanoClusterResponse> {
  try {
    // Build Supabase query with filters
    let query = supabase
      .from('site_data_5g')
      .select('nano_cluster, imp_integ_af, rfs_af')
      .not('nano_cluster', 'is', null)
      .neq('nano_cluster', '');
    
    // Apply filters (multi-value)
    if (filters?.vendorNames && filters.vendorNames.length > 0) {
      query = query.in('vendor_name', filters.vendorNames)
    }
    if (filters?.programReports && filters.programReports.length > 0) {
      query = query.in('program_report', filters.programReports)
    }
    if (filters?.impTtps && filters.impTtps.length > 0) {
      query = query.in('imp_ttp', filters.impTtps)
    }
    
    const { data, error } = await query;
    
    if (error) {
      console.error('Supabase Error:', error);
      return {
        status: 'error',
        data: {
          totalClusters: 0,
          readinessLess50: 0,
          readiness50to80: 0,
          readiness80to99: 0,
          readiness100: 0,
          completed: 0
        },
        timestamp: new Date().toISOString()
      };
    }
    
    // Process data to group by nano_cluster
    const clusterData: { [key: string]: { totalSites: number; readySites: number; activatedSites: number } } = {};
    
    data?.forEach(row => {
      const cluster = row.nano_cluster;
      if (!clusterData[cluster]) {
        clusterData[cluster] = { totalSites: 0, readySites: 0, activatedSites: 0 };
      }
      
      clusterData[cluster].totalSites++;
      
      if (row.imp_integ_af) {
        clusterData[cluster].readySites++;
      }
      
      if (row.rfs_af) {
        clusterData[cluster].activatedSites++;
      }
    });
    
    // Calculate readiness percentages and categories
    let readinessLess50 = 0;
    let readiness50to80 = 0;
    let readiness80to99 = 0;
    let readiness100 = 0;
    let completed = 0;
    
    Object.values(clusterData).forEach(cluster => {
      const readinessPercentage = cluster.totalSites > 0 ? (cluster.readySites / cluster.totalSites) * 100 : 0;
      const activationPercentage = cluster.totalSites > 0 ? (cluster.activatedSites / cluster.totalSites) * 100 : 0;
      
      // Categorize by readiness percentage
      if (readinessPercentage < 50) {
        readinessLess50++;
      } else if (readinessPercentage >= 50 && readinessPercentage < 80) {
        readiness50to80++;
      } else if (readinessPercentage >= 80 && readinessPercentage < 99) {
        readiness80to99++;
      } else if (readinessPercentage >= 99 && readinessPercentage < 100) {
        readiness100++;
      } else if (readinessPercentage === 100) {
        readiness100++;
      }
      
      // Check if cluster is 100% activated
      if (activationPercentage === 100) {
        completed++;
      }
    });
    
    const totalClusters = Object.keys(clusterData).length;
    
    const result: NanoClusterData = {
      totalClusters,
      readinessLess50,
      readiness50to80,
      readiness80to99,
      readiness100,
      completed
    };
    
    console.log('Nano Cluster data from DB:', result);
    
    return {
      status: 'success',
      data: result,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting nano cluster data:', error);
    return {
      status: 'error',
      data: {
        totalClusters: 0,
        readinessLess50: 0,
        readiness50to80: 0,
        readiness80to99: 0,
        readiness100: 0,
        completed: 0
      },
      timestamp: new Date().toISOString()
    };
  }
}

 
