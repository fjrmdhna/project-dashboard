"use client"

import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { MatrixStatsCard } from "@/components/cards/MatrixStatsCard"
import { TlpRfiByRegionCard } from "@/components/cards/TlpRfiByRegionCard"
import { TlpAccProgressCurveCard } from "@/components/cards/TlpAccProgressCurveCard"
import { TlpTopVendorRfiCard } from "@/components/cards/TlpTopVendorRfiCard"
import { TopIssueCard } from "@/components/cards/TopIssueCard"
import { TlpAdminBottleneckCard } from "@/components/cards/TlpAdminBottleneckCard"
import { Wallboard1080 } from "@/layouts/Wallboard1080"
import { useTlpAccProgressCurve } from "@/hooks/useTlpAccProgressCurve"
import { TlpNewSiteFilterBar } from "@/components/filters/TlpNewSiteFilterBar"
import { useTlpMatrixStats } from "@/hooks/useTlpMatrixStats"
import { useTlpRfiByRegion } from "@/hooks/useTlpRfiByRegion"
import { useTlpTopVendorRfi } from "@/hooks/useTlpTopVendorRfi"
import { useTlpTopIssueData } from "@/hooks/useTlpTopIssueData"
import { useTlpAdminBottleneck } from "@/hooks/useTlpAdminBottleneck"
import { useState } from "react"
import { type FilterValue } from "@/components/filters/FilterBar"
import { type TlpSiteFilters } from "@/lib/tlp-new-site-filters"

function EmptyPlaceholder({ className = "" }: { className?: string }) {
  return (
    <div
      className={`h-full w-full rounded-2xl border border-white/10 bg-[#0F1630]/80 backdrop-blur-sm ${className}`}
      aria-hidden="true"
    />
  )
}

const INITIAL_TLP_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  imp_ttp: [],
  nano_cluster: [],
  status: [],
  region: [],
  year: [],
  circle: [],
  site_category: [],
  ran_score: [],
  pm_indosat: [],
  wbs_status: [],
  priority_congest_urgent: [],
  trial_gb_factory: [],
}

export default function TlpNewSitePage() {
  const [filter, setFilter] = useState<FilterValue>(INITIAL_TLP_FILTER)

  const tlpFilters: TlpSiteFilters = {
    year: filter.year?.length ? filter.year.map((y) => Number(y)).filter((n) => !Number.isNaN(n)) : undefined,
    program_name: filter.program_report?.length ? filter.program_report : undefined,
    wbs_status: filter.wbs_status?.length ? filter.wbs_status : undefined,
    site_category: filter.site_category?.length ? filter.site_category : undefined,
    twr_owner: filter.vendor_name?.length ? filter.vendor_name : undefined,
  }

  const {
    totalSites,
    crfi: siteCrfiCount,
    rfi: siteRfiCount,
    construction: siteConstructionCount,
    rfc: siteRfcCount,
    sitac: siteSitacCount,
    searching: siteSearchingCount,
    returnCount: siteReturnCount,
  } = useTlpMatrixStats(tlpFilters)
  const { data: rfiByRegion, totalRfi, loading: rfiLoading, error: rfiError } = useTlpRfiByRegion(tlpFilters)
  const { data: topVendorRfi, loading: vendorLoading, error: vendorError } = useTlpTopVendorRfi(tlpFilters)
  const { data: accProgress, loading: accProgressLoading, error: accProgressError } = useTlpAccProgressCurve(tlpFilters)
  const { issues, topIssuesTotal, totalIssues, loading: topIssueLoading } = useTlpTopIssueData(tlpFilters)
  const { rows: adminRows, total: adminTotal, loading: adminLoading, error: adminError } = useTlpAdminBottleneck(tlpFilters)

  const currentDate = new Date()
  const formattedDate = currentDate.toLocaleDateString("id-ID", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  })

  const header = (
    <ProgramHeader
      title="Dashboard TLP New Site"
      dateLabel={formattedDate}
      mapHref="/tlp-new-site/map"
    />
  )

  const placeholderCard = <EmptyPlaceholder />
  const matrixStats = (
    <MatrixStatsCard
      variant="tlp"
      rows={[]}
      stats={{
        totalSites,
        crfi: siteCrfiCount,
        rfi: siteRfiCount,
        construction: siteConstructionCount,
        rfc: siteRfcCount,
        sitac: siteSitacCount,
        searching: siteSearchingCount,
        returnCount: siteReturnCount,
      }}
    />
  )
  const rfiByRegionCard = (
    <TlpRfiByRegionCard rows={rfiByRegion} totalRfi={totalRfi} isLoading={rfiLoading} error={rfiError} />
  )
  const topVendorRfiCard = (
    <TlpTopVendorRfiCard rows={topVendorRfi} isLoading={vendorLoading} error={vendorError} />
  )
  const accProgressCurveCard = (
    <TlpAccProgressCurveCard data={accProgress} isLoading={accProgressLoading} error={accProgressError} />
  )
  const topIssueCard = (
    <TopIssueCard issues={issues} totalIssues={totalIssues} topIssuesTotal={topIssuesTotal} isLoading={topIssueLoading} />
  )
  const adminBottleneckCard = (
    <TlpAdminBottleneckCard rows={adminRows} total={adminTotal} isLoading={adminLoading} error={adminError} />
  )

  return (
    <Wallboard1080
      header={header}
      filterBar={<TlpNewSiteFilterBar value={filter} onChange={setFilter} onReset={() => setFilter(INITIAL_TLP_FILTER)} />}
      matrixStats={matrixStats}
      readinessCard={rfiByRegionCard}
      activatedCard={topVendorRfiCard}
      progressCurve={accProgressCurveCard}
      dailyRunrate={placeholderCard}
      top5Issue={topIssueCard}
      nanoCluster={adminBottleneckCard}
      newFeature={placeholderCard}
      leaderboard={placeholderCard}
    />
  )
}
