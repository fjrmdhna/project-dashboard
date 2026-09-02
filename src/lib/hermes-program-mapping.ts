/**
 * Mapping configuration untuk program_report di Hermes 5G
 * Maps database program_report values ke display names untuk filter dropdown
 */

export interface ProgramMapping {
  displayName: string
  patterns: string[] // Array of program_report patterns to match
  exactMatch?: boolean // If true, use exact match; if false, use contains match
}

/**
 * Mapping configuration berdasarkan gambar requirement
 * Display name → Array of program_report patterns
 */
export const HERMES_PROGRAM_MAPPING: ProgramMapping[] = [
  {
    displayName: 'Hermes H1 2025',
    patterns: ['Hermes H1 Project 5G : 1202 sites'],
    exactMatch: true
  },
  {
    displayName: 'Hermes H2 B1 2025',
    patterns: ['Hermes H2 Batch 1 2025 : 1634 sites'],
    exactMatch: true
  },
  {
    displayName: 'Hermes H2 B2 2025',
    patterns: ['Hermes H2 Batch 2 2025 : 5752 sites'],
    exactMatch: true
  },
  {
    displayName: 'Hermes H1 2026',
    patterns: ['Hermes H1 2026'],
    exactMatch: true
  },
  {
    displayName: 'Hermes New Site AOP',
    patterns: [
      ' - Scope 5G (New Site AOP)',
      'Scope 5G (New Site AOP)',
      '- Scope 5G (New Site AOP)',
      'Q2 New Sites AOP 2025 : 1356 sites - Scope 5G (New Site AOP)',
      'H2B2 New Sites AOP 2025 : 426 sites - Scope 5G (New Site AOP)',
      'H2B3 New Sites AOP 2025 VVIP : 24 sites - Scope 5G (New Site AOP)',
      'Hermes H-1 16 New Site Capacity - Scope 5G (New Site AOP)',
      'Hermes H-1 16 New Site Capacity', // Match with dash
      'Hermes H1 16 New Site Capacity' // Match without dash (alternative format)
    ],
    exactMatch: false // Use contains match for flexibility
  }
]

/**
 * Normalize program report for flexible matching (handles H-1 vs H1 variations)
 * This ensures "Hermes H-1 16 New Site Capacity" and "Hermes H1 16 New Site Capacity" match the same pattern
 */
function normalizeForMatching(text: string): string {
  // Normalize H-1 and H1 to same pattern for flexible matching
  // Replace "H-1" or "H1" followed by "16 New Site Capacity" with normalized pattern
  return text
    .replace(/H-?1\s*16\s*New\s*Site\s*Capacity/gi, 'H1_16_NEW_SITE_CAPACITY')
    .toLowerCase()
    .trim()
}

/**
 * Get all program_report values that match a display name
 */
export function getProgramReportsForDisplayName(displayName: string, allProgramReports: string[]): string[] {
  const mapping = HERMES_PROGRAM_MAPPING.find(m => m.displayName === displayName)
  
  if (!mapping) {
    // If no mapping found, return empty array (or could return displayName itself if it's an exact match)
    return []
  }
  
  const matchedProgramReports: string[] = []
  
  for (const pattern of mapping.patterns) {
    for (const programReport of allProgramReports) {
      if (mapping.exactMatch) {
        if (programReport === pattern) {
          matchedProgramReports.push(programReport)
        }
      } else {
        // Contains match with normalization for H-1/H1 variations
        // First try direct contains match (faster)
        if (programReport.includes(pattern)) {
          matchedProgramReports.push(programReport)
        } else {
          // If direct match fails, try normalized matching for H-1/H1 variations
          const normalizedPattern = normalizeForMatching(pattern)
          const normalizedProgramReport = normalizeForMatching(programReport)
          
          // Check if normalized versions match
          if (normalizedProgramReport.includes(normalizedPattern) || normalizedPattern.includes(normalizedProgramReport)) {
            matchedProgramReports.push(programReport)
          }
        }
      }
    }
  }
  
  return [...new Set(matchedProgramReports)] // Remove duplicates
}

/**
 * Get display name for a program_report value
 * Returns the program_report itself if no mapping found
 */
export function getDisplayNameForProgramReport(programReport: string | null | undefined): string {
  if (!programReport) return programReport || ''
  
  for (const mapping of HERMES_PROGRAM_MAPPING) {
    for (const pattern of mapping.patterns) {
      if (mapping.exactMatch) {
        if (programReport === pattern) {
          return mapping.displayName
        }
      } else {
        // Contains match with normalization for H-1/H1 variations
        // First try direct contains match (faster)
        if (programReport.includes(pattern)) {
          return mapping.displayName
        } else {
          // If direct match fails, try normalized matching for H-1/H1 variations
          const normalizedPattern = normalizeForMatching(pattern)
          const normalizedProgramReport = normalizeForMatching(programReport)
          
          // Check if normalized versions match
          if (normalizedProgramReport.includes(normalizedPattern) || normalizedPattern.includes(normalizedProgramReport)) {
            return mapping.displayName
          }
        }
      }
    }
  }
  
  // If no mapping found, return original program_report
  return programReport
}

/**
 * Get all display names from mapping configuration
 */
export function getAllDisplayNames(): string[] {
  return HERMES_PROGRAM_MAPPING.map(m => m.displayName)
}

/**
 * Check if a program_report is mapped to a display name
 */
export function isProgramReportMapped(programReport: string | null | undefined): boolean {
  if (!programReport) return false
  
  for (const mapping of HERMES_PROGRAM_MAPPING) {
    for (const pattern of mapping.patterns) {
      if (mapping.exactMatch) {
        if (programReport === pattern) return true
      } else {
        // Contains match with normalization for H-1/H1 variations
        // First try direct contains match (faster)
        if (programReport.includes(pattern)) {
          return true
        } else {
          // If direct match fails, try normalized matching for H-1/H1 variations
          const normalizedPattern = normalizeForMatching(pattern)
          const normalizedProgramReport = normalizeForMatching(programReport)
          
          // Check if normalized versions match
          if (normalizedProgramReport.includes(normalizedPattern) || normalizedPattern.includes(normalizedProgramReport)) {
            return true
          }
        }
      }
    }
  }
  
  return false
}

/**
 * Get all program_report values that are NOT mapped to any display name
 * These should be displayed as-is in the filter
 */
export function getUnmappedProgramReports(allProgramReports: string[]): string[] {
  return allProgramReports.filter(pr => !isProgramReportMapped(pr))
}

/** Expand filter dropdown values (display names or raw program_report) for export/API queries. */
export function expandProgramReportFilterValues(
  filterValues: string[],
  allProgramReports: string[]
): string[] {
  const expanded = new Set<string>()

  for (const filterValue of filterValues) {
    const matched = getProgramReportsForDisplayName(filterValue, allProgramReports)
    if (matched.length > 0) {
      matched.forEach((programReport) => expanded.add(programReport))
    } else {
      expanded.add(filterValue)
    }
  }

  return Array.from(expanded)
}
