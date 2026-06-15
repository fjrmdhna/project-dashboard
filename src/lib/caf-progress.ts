import { getTlpSupabaseClient } from "@/lib/tlp-new-site-server"
import { getCacheOrFetch } from "@/lib/redis"
import type { ProjectProgress } from "@/lib/project-progress"

const CACHE_TTL_SECONDS = 5 * 60

export async function getCafProgress(): Promise<ProjectProgress> {
  return getCacheOrFetch(
    "caf-progress:v1",
    async () => {
      const supabase = getTlpSupabaseClient()

      const [totalResult, implementedResult] = await Promise.all([
        supabase.from("site_data_caf").select("*", { count: "exact", head: true }),
        supabase
          .from("site_data_caf")
          .select("*", { count: "exact", head: true })
          .not("implemented_date", "is", null),
      ])

      if (totalResult.error) throw new Error(totalResult.error.message)
      if (implementedResult.error) throw new Error(implementedResult.error.message)

      const scope = totalResult.count ?? 0
      const activated = implementedResult.count ?? 0
      const progress = scope > 0 ? Math.round((activated / scope) * 1000) / 10 : 0

      return { scope, activated, progress }
    },
    CACHE_TTL_SECONDS
  )
}
