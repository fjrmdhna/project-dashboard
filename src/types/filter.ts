// Filter State Interface
export interface FilterState {
  vendorFilter: string;
  programFilter: string;
  cityFilter: string;
  nanoClusterFilter: string;
  ranScoreFilter: string;
  searchTerm: string;
  statusFilter: string;
  regionFilter: string;
  statusFilters: string[]; // Array untuk multiple status selection
}

// Filter Actions Interface
export interface FilterActions {
  setVendorFilter: (vendor: string) => void;
  setProgramFilter: (program: string) => void;
  setCityFilter: (city: string) => void;
  setNanoClusterFilter: (nanoCluster: string) => void;
  setRanScoreFilter: (ranScore: string) => void;
  setSearchTerm: (search: string) => void;
  setStatusFilter: (status: string) => void;
  setRegionFilter: (region: string) => void;
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
  searchTerm: '',
  statusFilter: 'all',
  regionFilter: 'all',
  statusFilters: [] // Empty array untuk no status filters
};
