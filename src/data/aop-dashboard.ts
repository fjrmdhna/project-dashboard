import { FilterValue } from "@/components/filters/FilterBar"
import type { Row as MatrixRow } from "@/components/cards/MatrixStatsCard"

export type AopDashboardRow = MatrixRow & {
  nano_cluster?: string | null
  region_circle?: string | null
  mocn_activation_forecast?: string | null
  lat?: number | null
  long?: number | null
}

// Placeholder data - akan diganti dengan data dari API saat halaman map menggunakan data real
export const AOP_DASHBOARD_ROWS: AopDashboardRow[] = []

export const AOP_INITIAL_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  circle: [],
  ran_score: [],
  status: []
}

