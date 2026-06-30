"use client"

import { useEffect, useMemo, useState } from "react"
import { RotateCcw, X } from "lucide-react"
import { type FilterValue } from "@/components/filters/FilterBar"
import { MultiSelect } from "@/components/ui/MultiSelect"

type TlpNewSiteFilterOptions = {
  programGroups: string[]
  vendors: string[]
  projects: string[]
  years: string[]
  siteCategories: string[]
}

type TlpNewSiteFilterOptionsResponse = {
  status: "success" | "error"
  data?: TlpNewSiteFilterOptions
  message?: string
}

const FILTER_GRID_STYLE = {
  gridTemplateColumns: "repeat(5, minmax(0, 1fr)) auto",
} as const

export function TlpNewSiteFilterBar({
  value,
  onChange,
  onReset,
  variant = "wallboard",
}: {
  value: FilterValue
  onChange: (v: FilterValue) => void
  onReset: () => void
  /** `stacked` — vertical grid for mobile filter drawer */
  variant?: "wallboard" | "stacked"
}) {
  const [options, setOptions] = useState<TlpNewSiteFilterOptions>({
    programGroups: [],
    vendors: [],
    projects: [],
    years: [],
    siteCategories: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        const response = await fetch("/api/tlp-new-site/filters")
        const payload: TlpNewSiteFilterOptionsResponse = await response.json()
        if (!cancelled && payload?.status === "success" && payload.data) {
          setOptions({
            programGroups: payload.data.programGroups ?? [],
            vendors: payload.data.vendors ?? [],
            projects: payload.data.projects ?? [],
            years: payload.data.years ?? [],
            siteCategories: payload.data.siteCategories ?? [],
          })
        }
      } catch {
        // Fail silently; keep dropdowns empty rather than crashing the dashboard.
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  const hasActiveFilters = useMemo(() => {
    return (
      (value.program_group?.length ?? 0) > 0 ||
      (value.project_name?.length ?? 0) > 0 ||
      (value.year?.length ?? 0) > 0 ||
      (value.site_category?.length ?? 0) > 0 ||
      (value.vendor_name?.length ?? 0) > 0
    )
  }, [value])

  const isStacked = variant === "stacked"

  const filterFields = (
    <>
      <div className="min-w-0">
        <MultiSelect
          options={options.programGroups}
          selected={value.program_group ?? []}
          placeholder="Group"
          onChange={(selected) => onChange({ ...value, program_group: selected })}
          disabled={loading}
          width="w-full"
        />
      </div>

      <div className="min-w-0">
        <MultiSelect
          options={options.projects}
          selected={value.project_name ?? []}
          placeholder="Project"
          onChange={(selected) => onChange({ ...value, project_name: selected })}
          disabled={loading}
          width="w-full"
        />
      </div>

      <div className="min-w-0">
        <MultiSelect
          options={options.years}
          selected={value.year ?? []}
          placeholder="Year"
          onChange={(selected) => onChange({ ...value, year: selected })}
          disabled={loading}
          width="w-full"
        />
      </div>

      <div className="min-w-0">
        <MultiSelect
          options={options.siteCategories}
          selected={value.site_category ?? []}
          placeholder="Site Category"
          onChange={(selected) => onChange({ ...value, site_category: selected })}
          disabled={loading}
          width="w-full"
        />
      </div>

      <div className="min-w-0">
        <MultiSelect
          options={options.vendors}
          selected={value.vendor_name ?? []}
          placeholder="Vendor Tower"
          onChange={(selected) => onChange({ ...value, vendor_name: selected })}
          disabled={loading}
          width="w-full"
        />
      </div>
    </>
  )

  if (isStacked) {
    return (
      <div className="rounded-xl border-0 bg-transparent px-0 py-0">
        <div className="grid w-full grid-cols-1 gap-2.5 text-xs sm:grid-cols-2">
          {filterFields}
          <button
            type="button"
            onClick={onReset}
            disabled={!hasActiveFilters || loading}
            className={`col-span-1 inline-flex h-9 w-full shrink-0 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors sm:col-span-2 ${
              hasActiveFilters && !loading
                ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
                : "cursor-not-allowed border-white/5 text-white/35"
            }`}
            aria-label="Reset filters"
          >
            <RotateCcw className="h-3 w-3" />
            Reset
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 items-center">
      <div className="grid w-full items-center gap-1.5 text-xs" style={FILTER_GRID_STYLE}>
        {filterFields}
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters || loading}
          className={`inline-flex h-6 shrink-0 items-center justify-center gap-0.5 rounded-md border px-1.5 text-xs font-semibold transition-colors ${
            hasActiveFilters && !loading
              ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
              : "cursor-not-allowed border-white/5 bg-transparent text-gray-400"
          }`}
          aria-label="Reset filters"
        >
          <X className="h-3 w-3" />
          Reset
        </button>
      </div>
    </div>
  )
}
