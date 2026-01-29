// Filter State Interface
export interface FilterState {
  vendorFilter: string;
  programFilter: string;
  cityFilter: string;
  nanoClusterFilter: string;
  ranScoreFilter: string;
  yearFilter: string;
  searchTerm: string;
  statusFilter: string;
  regionFilter: string;
  circleFilter: string; // Circle filter (region_circle)
  siteCategoryFilter: string; // Site category filter (Hermes / AOP)
  statusFilters: string[]; // Array untuk multiple status selection
}

// Filter Actions Interface
export interface FilterActions {
  setVendorFilter: (vendor: string) => void;
  setProgramFilter: (program: string) => void;
  setCityFilter: (city: string) => void;
  setNanoClusterFilter: (nanoCluster: string) => void;
  setRanScoreFilter: (ranScore: string) => void;
  setYearFilter: (year: string) => void;
  setSearchTerm: (search: string) => void;
  setStatusFilter: (status: string) => void;
  setRegionFilter: (region: string) => void;
  setCircleFilter: (circle: string) => void;
  setSiteCategoryFilter: (siteCategory: string) => void;
  setStatusFilters: (statuses: string[]) => void; // New action for multiple status selection
  resetFilters: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
}

// Filter Context Interface
export interface FilterContextType extends FilterState, FilterActions {
  isHydrated?: boolean
  debouncedFilters?: FilterState // Debounced version of filters for use in hooks
}

// Filter Options Interface
export interface FilterOptions {
  vendors: string[];
  programs: string[];
  cities: string[];
  statuses: string[];
  regions: string[];
  ranScores?: string[];
}

// Default Filter Values
export const DEFAULT_FILTERS: FilterState = {
  vendorFilter: 'all',
  programFilter: 'all',
  cityFilter: 'all',
  nanoClusterFilter: 'all',
  ranScoreFilter: 'all',
  yearFilter: 'all',
  searchTerm: '',
  statusFilter: 'all',
  regionFilter: 'all',
  circleFilter: 'all',
  siteCategoryFilter: 'all',
  statusFilters: [] // Empty array untuk no status filters
};
