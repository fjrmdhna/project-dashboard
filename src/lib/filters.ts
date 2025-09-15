import { FilterValue } from '@/components/filters/FilterBar'

// Build URLSearchParams from FilterValue using consistent param names
export function buildFilterParams(filter: FilterValue): URLSearchParams {
  const p = new URLSearchParams()
  if (filter.q) p.append('q', filter.q)
  filter.vendor_name?.forEach(v => v && p.append('vendor_name', v))
  filter.program_report?.forEach(pgm => pgm && p.append('program_report', pgm))
  filter.imp_ttp?.forEach(c => c && p.append('imp_ttp', c))
  return p
}

// Parse multi-value params from a URL instance
export function parseFilterParams(url: URL) {
  const q = url.searchParams.get('q') || ''
  const vendorNames = url.searchParams.getAll('vendor_name') || []
  const programReports = url.searchParams.getAll('program_report') || []
  const impTtps = url.searchParams.getAll('imp_ttp') || []

  return { q, vendorNames, programReports, impTtps }
}

