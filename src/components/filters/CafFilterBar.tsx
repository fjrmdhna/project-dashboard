"use client"

import { useEffect, useMemo, useState } from "react"
import { RotateCcw } from "lucide-react"
import { MultiSelect } from "@/components/ui/MultiSelect"
import type { CafSiteFilters } from "@/lib/caf-filters"

type CafFilterOptions = {
  projects: string[]
  vendorTlp: string[]
  vendorRequestor: string[]
  cafStatus: string[]
  cafType: string[]
  avp: string[]
  year: string[]
}

const INITIAL_FILTERS: CafSiteFilters = {}

export function getInitialCafFilters(): CafSiteFilters {
  return { ...INITIAL_FILTERS }
}

export function CafFilterBar({
  value,
  onChange,
  onReset,
  variant = "wallboard",
}: {
  value: CafSiteFilters
  onChange: (v: CafSiteFilters) => void
  onReset: () => void
  /** `stacked` — vertical grid for mobile filter drawer */
  variant?: "wallboard" | "stacked"
}) {
  const [options, setOptions] = useState<CafFilterOptions>({
    projects: [],
    vendorTlp: [],
    vendorRequestor: [],
    cafStatus: [],
    cafType: [],
    avp: [],
    year: [],
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        setLoading(true)
        const response = await fetch("/api/caf/filters")
        const payload = await response.json()
        if (!cancelled && payload?.status === "success" && payload.data) {
          setOptions({
            projects: payload.data.projects ?? [],
            vendorTlp: payload.data.vendorTlp ?? [],
            vendorRequestor: payload.data.vendorRequestor ?? [],
            cafStatus: payload.data.cafStatus ?? [],
            cafType: payload.data.cafType ?? [],
            avp: payload.data.avp ?? [],
            year: payload.data.year ?? [],
          })
        }
      } catch {
        // Keep dropdowns empty on failure.
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
      Boolean(value.q?.trim()) ||
      (value.project_name?.length ?? 0) > 0 ||
      (value.vendor_tlp_name?.length ?? 0) > 0 ||
      (value.vendor_requestor_name?.length ?? 0) > 0 ||
      (value.caf_status?.length ?? 0) > 0 ||
      (value.caf_type?.length ?? 0) > 0 ||
      (value.avp?.length ?? 0) > 0 ||
      (value.year?.length ?? 0) > 0
    )
  }, [value])

  const isStacked = variant === "stacked"

  return (
    <div
      className={`caf-filter-bar rounded-xl border border-white/5 bg-[#0F1630]/60 px-2 py-1.5 ${
        isStacked
          ? "caf-filter-bar--stacked border-0 bg-transparent px-0 py-0"
          : "caf-filter-bar--wallboard"
      }`}
    >
      <div
        className={
          isStacked
            ? "grid w-full grid-cols-1 gap-2.5 text-xs sm:grid-cols-2"
            : "caf-filter-bar__wallboard-grid grid w-full items-center gap-1.5 text-xs"
        }
      >
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
            options={options.cafStatus}
            selected={value.caf_status ?? []}
            placeholder="CAF Status"
            onChange={(selected) => onChange({ ...value, caf_status: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={options.vendorTlp}
            selected={value.vendor_tlp_name ?? []}
            placeholder="TLP Vendor"
            onChange={(selected) => onChange({ ...value, vendor_tlp_name: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={options.vendorRequestor}
            selected={value.vendor_requestor_name ?? []}
            placeholder="RAN Vendor"
            onChange={(selected) => onChange({ ...value, vendor_requestor_name: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={options.cafType}
            selected={value.caf_type ?? []}
            placeholder="CAF Type"
            onChange={(selected) => onChange({ ...value, caf_type: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={options.avp}
            selected={value.avp ?? []}
            placeholder="AVP"
            onChange={(selected) => onChange({ ...value, avp: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={options.year}
            selected={value.year ?? []}
            placeholder="Year"
            onChange={(selected) => onChange({ ...value, year: selected })}
            disabled={loading}
            width="w-full"
          />
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters || loading}
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
            isStacked ? "col-span-1 w-full sm:col-span-2" : "caf-filter-bar__reset h-6 px-2 text-[10px]"
          } ${
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
