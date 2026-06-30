"use client"

import { useCallback, useMemo, useState, useTransition } from "react"
import { DashboardExportButton, downloadExportResponse } from "@/components/dashboard/DashboardExportButton"
import { ProgramHeader } from "@/components/dashboard/ProgramHeader"
import { TlpNewSiteFilterBar } from "@/components/filters/TlpNewSiteFilterBar"
import { TlpNewSiteWallboard } from "@/components/tlp-new-site/TlpNewSiteWallboard"
import { type FilterValue } from "@/components/filters/FilterBar"
import { type TlpSiteFilters, tlpFiltersToQueryString } from "@/lib/tlp-new-site-filters"

const INITIAL_TLP_FILTER: FilterValue = {
  q: "",
  vendor_name: [],
  program_report: [],
  project_name: [],
  program_group: [],
  imp_ttp: [],
  nano_cluster: [],
  status: [],
  region: [],
  year: [],
  circle: [],
  site_category: [],
  ran_score: [],
  pm_indosat: [],
  priority_congest_urgent: [],
  trial_gb_factory: [],
}

export default function TlpNewSitePage() {
  const [filter, setFilter] = useState<FilterValue>(INITIAL_TLP_FILTER)
  const [isExporting, setIsExporting] = useState(false)
  const [, startFilterTransition] = useTransition()

  const handleFilterChange = useCallback((next: FilterValue) => {
    startFilterTransition(() => setFilter(next))
  }, [])

  const handleFilterReset = useCallback(() => {
    startFilterTransition(() => setFilter(INITIAL_TLP_FILTER))
  }, [])

  const tlpFilters: TlpSiteFilters = useMemo(
    () => ({
      year: filter.year?.length ? filter.year.map((y) => Number(y)).filter((n) => !Number.isNaN(n)) : undefined,
      program_group: filter.program_group?.length ? filter.program_group : undefined,
      project_name: filter.project_name?.length ? filter.project_name : undefined,
      site_category: filter.site_category?.length ? filter.site_category : undefined,
      twr_owner: filter.vendor_name?.length ? filter.vendor_name : undefined,
    }),
    [filter]
  )

  const formattedDate = useMemo(
    () =>
      new Date().toLocaleDateString("id-ID", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      }),
    []
  )

  const handleExport = useCallback(async () => {
    try {
      setIsExporting(true)
      const qs = tlpFiltersToQueryString(tlpFilters)
      const response = await fetch(qs ? `/api/tlp-new-site/export?${qs}` : "/api/tlp-new-site/export")
      await downloadExportResponse(response, "tlp-new-site-export.xlsx")
    } catch (exportError) {
      console.error("Failed to export TLP New Site data", exportError)
    } finally {
      setIsExporting(false)
    }
  }, [tlpFilters])

  const header = useMemo(
    () => (
      <ProgramHeader
        title="Dashboard TLP New Site"
        dateLabel={formattedDate}
        mapHref="/tlp-new-site/map"
        exportButton={<DashboardExportButton onClick={handleExport} isExporting={isExporting} />}
      />
    ),
    [formattedDate, handleExport, isExporting]
  )

  const filterBar = useMemo(
    () => (
      <TlpNewSiteFilterBar value={filter} onChange={handleFilterChange} onReset={handleFilterReset} />
    ),
    [filter, handleFilterChange, handleFilterReset]
  )

  return <TlpNewSiteWallboard tlpFilters={tlpFilters} header={header} filterBar={filterBar} />
}
