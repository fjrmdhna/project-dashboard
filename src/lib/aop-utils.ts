import type { FilterValue } from "@/components/filters/FilterBar"
import type { HermesMapPoint, StatusLabel } from "@/components/maps/Hermes5GMap"
import type { NewSiteDashboardRow } from "@/data/aop-dashboard"

/**
 * Derive New Site status from row data
 * Priority: ACTIVE > READY > RFI > SOW
 */
export function deriveNewSiteStatus(row: NewSiteDashboardRow): StatusLabel {
  // ACTIVE: rfs_af is filled
  if (row.rfs_af) {
    return 'ACTIVE'
  }

  // READY: imp_integ_af is filled (5G Readiness)
  if (row.imp_integ_af) {
    return 'READY'
  }

  // RFI: caf_approved (rfi_accepted) is filled
  if (row.caf_approved) {
    return 'RFI'
  }

  // SOW: system_key exists but no other milestones
  return 'SOW'
}

/**
 * Filter New Site rows based on FilterValue
 */
export function filterNewSiteRows(rows: NewSiteDashboardRow[], filter: FilterValue): NewSiteDashboardRow[] {
  return rows.filter(row => {
    // Search filter
    if (filter.q) {
      const searchTerm = filter.q.toLowerCase()
      const searchableFields = [
        row.system_key,
        row.site_id,
        row.site_name,
        row.vendor_name,
        row.program_report
      ].filter(Boolean).map(String).join(' ').toLowerCase()
      
      if (!searchableFields.includes(searchTerm)) {
        return false
      }
    }

    // Vendor filter
    if (filter.vendor_name && filter.vendor_name.length > 0) {
      if (!row.vendor_name || !filter.vendor_name.includes(row.vendor_name)) {
        return false
      }
    }

    // Program filter
    if (filter.program_report && filter.program_report.length > 0) {
      if (!row.program_report || !filter.program_report.includes(row.program_report)) {
        return false
      }
    }

    // Circle filter (New Site uses circle instead of imp_ttp/nano_cluster)
    if (filter.circle && filter.circle.length > 0) {
      const rowCircle = row.region_circle || row.nano_cluster
      if (!rowCircle || !filter.circle.includes(rowCircle)) {
        return false
      }
    }

    // Status filter
    if (filter.status && filter.status.length > 0) {
      const rowStatus = deriveNewSiteStatus(row)
      if (!filter.status.includes(rowStatus)) {
        return false
      }
    }

    return true
  })
}

/**
 * Convert New Site rows to HermesMapPoint format
 */
export function toHermesMapPoints(rows: NewSiteDashboardRow[]): HermesMapPoint[] {
  return rows
    .filter(row => {
      // Only include rows with valid coordinates
      const lat = row.lat
      const long = row.long
      return lat != null && long != null && !isNaN(Number(lat)) && !isNaN(Number(long))
    })
    .map(row => {
      const lat = Number(row.lat)
      const long = Number(row.long)
      const status = deriveNewSiteStatus(row)

      return {
        id: row.system_key || '',
        status,
        lat,
        long,
        vendorName: row.vendor_name || null,
        siteName: row.site_name || null,
        siteId: row.site_id || null,
        programReport: row.program_report || null,
        impTtp: row.imp_ttp || row.region_circle || null,
        nanoCluster: row.nano_cluster || row.region_circle || null
      }
    })
}

