"use client"

import { useEffect, useMemo, useState } from "react"
import { X } from "lucide-react"
import { type FilterValue } from "@/components/filters/FilterBar"
import { MultiSelect } from "@/components/ui/MultiSelect"

type TlpNewSiteFilterOptions = {
  vendors: string[]
  programs: string[]
  years: string[]
  siteCategories: string[]
  wbsStatus: string[]
}

type TlpNewSiteFilterOptionsResponse = {
  status: "success" | "error"
  data?: TlpNewSiteFilterOptions
  message?: string
}

export function TlpNewSiteFilterBar({
  value,
  onChange,
  onReset,
}: {
  value: FilterValue
  onChange: (v: FilterValue) => void
  onReset: () => void
}) {
  const [options, setOptions] = useState<TlpNewSiteFilterOptions>({
    vendors: [],
    programs: [],
    years: [],
    siteCategories: [],
    wbsStatus: [],
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
            vendors: payload.data.vendors ?? [],
            programs: payload.data.programs ?? [],
            years: payload.data.years ?? [],
            siteCategories: payload.data.siteCategories ?? [],
            wbsStatus: payload.data.wbsStatus ?? [],
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
      (value.program_report?.length ?? 0) > 0 ||
      (value.wbs_status?.length ?? 0) > 0 ||
      (value.year?.length ?? 0) > 0 ||
      (value.site_category?.length ?? 0) > 0 ||
      (value.vendor_name?.length ?? 0) > 0
    )
  }, [value])

  return (
    <div className="h-full min-h-[68px] flex flex-col gap-2">
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs flex-shrink-0 w-full items-center">
        <div className="min-w-0">
          <MultiSelect
            options={options.programs}
            selected={value.program_report}
            placeholder="Program"
            onChange={(selected) => onChange({ ...value, program_report: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>

        <div className="min-w-0">
          <MultiSelect
            options={options.wbsStatus}
            selected={value.wbs_status ?? []}
            placeholder="WBS Status"
            onChange={(selected) => onChange({ ...value, wbs_status: selected })}
            disabled={loading}
            width="w-full"
            caseInsensitiveMatch
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
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters || loading}
          className={`inline-flex items-center justify-center rounded-md h-7 px-2 text-xs font-semibold transition-colors border ${
            hasActiveFilters && !loading
              ? "border-white/20 bg-white/10 text-white hover:bg-white/20"
              : "border-white/5 bg-transparent text-gray-400 cursor-not-allowed"
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

