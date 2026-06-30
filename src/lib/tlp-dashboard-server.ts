import { applyTlpProgramGroupScope, getTlpSupabaseClient } from "@/lib/tlp-new-site-server"

const PAGE_SIZE = 1000

export const TLP_DASHBOARD_SELECT_COLUMNS = [
  "program_group",
  "program_name",
  "project_name",
  "wbs_status",
  "wo_number_1",
  "year_from_wo",
  "site_category",
  "twr_owner",
  "site_status",
  "region_circle",
  "ic_000010_ff",
  "ic_000010_af",
  "rfi_accepted",
  "issue_category",
  "ran_vendor",
  "system_key",
  "return_replacement_status",
  "region",
] as const

export type TlpDashboardRow = {
  program_group?: string | null
  program_name?: string | null
  project_name?: string | null
  wbs_status?: string | null
  wo_number_1?: string | null
  year_from_wo?: number | null
  site_category?: string | null
  twr_owner?: string | null
  site_status?: string | null
  region_circle?: string | null
  ic_000010_ff?: string | null
  ic_000010_af?: string | null
  rfi_accepted?: string | null
  issue_category?: string | null
  ran_vendor?: string | null
  system_key?: string | null
  return_replacement_status?: string | null
  region?: string | null
}

/** Fetch scoped TLP rows once (program_group scope only). User filters applied client-side. */
export async function fetchTlpDashboardBaseRows(): Promise<TlpDashboardRow[]> {
  const supabase = getTlpSupabaseClient()
  const rows: TlpDashboardRow[] = []
  let offset = 0
  let hasMore = true
  const columns = TLP_DASHBOARD_SELECT_COLUMNS.join(",")

  while (hasMore) {
    const { data, error } = await applyTlpProgramGroupScope(
      supabase.from("site_data_tlp").select(columns)
    ).range(offset, offset + PAGE_SIZE - 1)

    if (error) {
      throw new Error(error.message)
    }

    for (const row of data ?? []) {
      rows.push(row as TlpDashboardRow)
    }

    hasMore = Boolean(data && data.length === PAGE_SIZE)
    offset += PAGE_SIZE
  }

  return rows
}
