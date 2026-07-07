import { getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import { getCacheOrFetch } from "@/lib/redis"
import type { ProjectProgress } from "@/lib/project-progress"

const CACHE_TTL_SECONDS = 5 * 60

export async function getCafProgress(): Promise<ProjectProgress> {
  return getCacheOrFetch(
    "caf-progress:v2",
    async () => {
      const supabase = getTlpSupabaseClient()

      const [totalResult, approvedWaitingResult, fullyImplementedResult] = await Promise.all([
        supabase.from("site_data_caf").select("*", { count: "exact", head: true }),
        supabase
          .from("site_data_caf")
          .select("*", { count: "exact", head: true })
          .ilike("caf_status", "Approve Waiting Implementation"),
        supabase
          .from("site_data_caf")
          .select("*", { count: "exact", head: true })
          .ilike("caf_status", "Fully Implemented"),
      ])

      if (totalResult.error) throw new Error(totalResult.error.message)
      if (approvedWaitingResult.error) throw new Error(approvedWaitingResult.error.message)
      if (fullyImplementedResult.error) throw new Error(fullyImplementedResult.error.message)

      const scope = totalResult.count ?? 0
      const readiness = approvedWaitingResult.count ?? 0
      const activated = fullyImplementedResult.count ?? 0

      // Progress model:
      // - 50% contribution from "Approve Waiting Implementation" coverage
      // - 50% contribution from "Fully Implemented" coverage
      // 100% is reached only when all CAF rows are fully implemented and readiness is complete.
      const progress =
        scope > 0 ? Math.round((((readiness / scope) + (activated / scope)) * 50) * 10) / 10 : 0

      return { scope, readiness, activated, progress }
    },
    CACHE_TTL_SECONDS
  )
}
