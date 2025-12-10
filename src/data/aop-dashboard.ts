import { FilterValue } from "@/components/filters/FilterBar"
import type { Row as MatrixRow } from "@/components/cards/MatrixStatsCard"

export type NewSiteDashboardRow = MatrixRow & {
  site_id?: string | null
  site_name?: string | null
  nano_cluster?: string | null
  region_circle?: string | null
  ran_score?: string | null
  mocn_activation_forecast?: string | null
  lat?: number | null
  long?: number | null
}

// Placeholder data - akan diganti dengan data dari API saat halaman map menggunakan data real
export const NEW_SITE_DASHBOARD_ROWS: NewSiteDashboardRow[] = []

export const NEW_SITE_INITIAL_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  circle: [],
  status: []
}

