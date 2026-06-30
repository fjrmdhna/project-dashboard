"use client"

import { memo, useMemo, type ReactNode } from "react"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { TlpRfiByCircleCard } from "@/components/cards/TlpRfiByCircleCard"
import { TlpAccProgressCurveCard } from "@/components/cards/TlpAccProgressCurveCard"
import { TlpTopVendorRfiCard } from "@/components/cards/TlpTopVendorRfiCard"
import { TlpIssueCard } from "@/components/cards/TlpIssueCard"
import { TlpProgramSiteCategoryCard } from "@/components/cards/TlpProgramSiteCategoryCard"
import { TlpWeeklyAchievementCard } from "@/components/cards/TlpWeeklyAchievementCard"
import { TlpRfiNotCrfiIssueCard } from "@/components/cards/TlpRfiNotCrfiIssueCard"
import { TlpSiteReturnCard } from "@/components/cards/TlpSiteReturnCard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useTlpDashboard } from "@/hooks/useTlpDashboard"
import type { TlpSiteFilters } from "@/lib/tlp-new-site-filters"

interface TlpNewSiteWallboardProps {
  tlpFilters: TlpSiteFilters
  header: ReactNode
  filterBar: ReactNode
}

function TlpNewSiteWallboardInner({ tlpFilters, header, filterBar }: TlpNewSiteWallboardProps) {
  const { committedDashboard, hasCommittedData, loading, isFilterPending, error } =
    useTlpDashboard(tlpFilters)

  const cardSlots = useMemo(() => {
    if (!committedDashboard) {
      return null
    }

    const d = committedDashboard

    return {
      matrixStats: (
        <MatrixStatsCard
          variant="tlp"
          rows={[]}
          stats={{
            totalSites: d.matrix.totalSites,
            crfi: d.matrix.crfi,
            rfi: d.matrix.rfi,
            construction: d.matrix.construction,
            rfc: d.matrix.rfc,
            sitac: d.matrix.sitac,
            searching: d.matrix.searching,
            returnCount: d.matrix.returnCount,
          }}
        />
      ),
      readinessCard: (
        <TlpRfiByCircleCard
          rows={d.rfiByCircle}
          totalPlanRfi={d.totalPlanRfi}
          totalActualRfi={d.totalActualRfi}
          isLoading={false}
          error={error}
        />
      ),
      activatedCard: <TlpTopVendorRfiCard rows={d.topVendorRfi} isLoading={false} error={error} />,
      progressCurve: <TlpAccProgressCurveCard data={d.accProgress} isLoading={false} error={error} />,
      dailyRunrate: (
        <TlpWeeklyAchievementCard
          monthLabel={d.weeklyAchievement.monthLabel}
          weeks={d.weeklyAchievement.weeks}
          mtd={d.weeklyAchievement.mtd}
          isLoading={false}
          error={error}
        />
      ),
      top5Issue: (
        <TlpIssueCard
          issues={d.issues}
          totalIssues={d.totalIssues}
          categoryCount={d.categoryCount}
          isLoading={false}
        />
      ),
      nanoCluster: (
        <TlpProgramSiteCategoryCard
          categories={d.programSiteCategory.categories}
          groups={d.programSiteCategory.groups}
          projectsByGroup={d.programSiteCategory.projectsByGroup}
          grandTotal={d.programSiteCategory.grandTotal}
          isLoading={false}
          error={error}
        />
      ),
      newFeature: (
        <TlpRfiNotCrfiIssueCard
          rows={d.rfiNotCrfi.rows}
          regions={d.rfiNotCrfi.regions}
          totalIssues={d.rfiNotCrfi.totalIssues}
          skippedWithoutRanVendor={d.rfiNotCrfi.skippedWithoutRanVendor}
          isLoading={false}
          error={error}
        />
      ),
      leaderboard: (
        <TlpSiteReturnCard
          rows={d.siteReturn.rows}
          statuses={d.siteReturn.statuses}
          woReleasedTotal={d.siteReturn.woReleasedTotal}
          inProcessTotal={d.siteReturn.inProcessTotal}
          grandTotal={d.siteReturn.grandTotal}
          skippedWithoutStatus={d.siteReturn.skippedWithoutStatus}
          isLoading={false}
          error={error}
        />
      ),
    }
  }, [committedDashboard, error])

  return (
    <div className="relative h-full w-full">
      {loading && !hasCommittedData ? (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center bg-[#050B1B]/55 backdrop-blur-[1px]">
          <span className="rounded-full border border-white/15 bg-[#0F1630]/90 px-4 py-2 text-xs font-medium text-white/80">
            Loading dashboard...
          </span>
        </div>
      ) : null}
      {isFilterPending ? (
        <div className="pointer-events-none absolute right-3 top-[4.5rem] z-20 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] text-cyan-200">
          Updating...
        </div>
      ) : null}
      {cardSlots ? (
        <Wallboard1080 header={header} filterBar={filterBar} {...cardSlots} />
      ) : (
        <Wallboard1080 header={header} filterBar={filterBar} />
      )}
    </div>
  )
}

export const TlpNewSiteWallboard = memo(TlpNewSiteWallboardInner)
