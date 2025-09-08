import { FilterOptions } from '@/types/filter'

// Filter Configuration - Updated to match existing component
export const FILTER_CONFIG: FilterOptions = {
  vendors: [
    'all',
    'PTHWI', // Huawei
    'PTNOK', // Nokia  
    'PTERI'  // Ericsson
  ],
  programs: [
    'all',
    'Hermes H2 Batch 1 2025',
    'Hermes H2 Batch 2 2025',
    'Hermes Project 5G'
  ],
  cities: [
    'all',
    'BANDUNG',
    'BATAM',
    'JABO',
    'MAKASSAR',
    'MALANG',
    'MEDAN',
    'PALEMBANG',
    'SEMARANG',
    'SURABAYA',
    'YOGYAKARTA'
  ],
  statuses: [
    'all',
    '12. On Air',
    '00D. Hold',
    '07. RFI',
    '08. CRFI',
    '09. MOS',
    '10. Installation',
    '11. Integration'
  ],
  regions: [
    'all',
    'WJRO',
    'EJRO',
    'JRO',
    'SPRO',
    'BRO',
    'CJRO',
    'CSRO',
    'NSRO',
    'SSRO'
  ]
}

// Filter Display Names (for UI)
export const FILTER_DISPLAY_NAMES = {
  vendors: {
    'all': 'All Vendors',
    'PTHWI': 'Huawei',
    'PTNOK': 'Nokia',
    'PTERI': 'Ericsson'
  },
  programs: {
    'all': 'All Programs'
  },
  cities: {
    'all': 'All Cities'
  },
  statuses: {
    'all': 'All Status',
    '12. On Air': 'On Air',
    '00D. Hold': 'Hold',
    '07. RFI': 'RFI',
    '08. CRFI': 'CRFI',
    '09. MOS': 'MOS',
    '10. Installation': 'Installation',
    '11. Integration': 'Integration'
  },
  regions: {
    'all': 'All Regions'
  }
}
