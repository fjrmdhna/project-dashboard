// Filter State Interface
export interface FilterState {
  vendorFilter: string;
  programFilter: string;
  cityFilter: string;
  nanoClusterFilter: string;
  searchTerm: string;
  statusFilter: string;
  regionFilter: string;
}

// Filter Actions Interface
export interface FilterActions {
  setVendorFilter: (vendor: string) => void;
  setProgramFilter: (program: string) => void;
  setCityFilter: (city: string) => void;
  setNanoClusterFilter: (nanoCluster: string) => void;
  setSearchTerm: (search: string) => void;
  setStatusFilter: (status: string) => void;
  setRegionFilter: (region: string) => void;
  resetFilters: () => void;
  setFilters: (filters: Partial<FilterState>) => void;
}

// Filter Context Interface
export interface FilterContextType extends FilterState, FilterActions {
  isHydrated?: boolean
}

// Filter Options Interface
export interface FilterOptions {
  vendors: string[];
  programs: string[];
  cities: string[];
  statuses: string[];
  regions: string[];
}

// Default Filter Values
export const DEFAULT_FILTERS: FilterState = {
  vendorFilter: 'all',
  programFilter: 'all',
  cityFilter: 'all',
  nanoClusterFilter: 'all',
  searchTerm: '',
  statusFilter: 'all',
  regionFilter: 'all'
};
