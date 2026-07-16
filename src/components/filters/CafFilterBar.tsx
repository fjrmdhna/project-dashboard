"use client"

import { useMemo } from "react"
import { RotateCcw } from "lucide-react"
import { MultiSelect } from "@/components/ui/MultiSelect"
import {
  EMPTY_CAF_FILTER_OPTIONS,
  getLandingCafSiteFilters,
  hasActiveCafFilters,
  type CafFilterOptions,
  type CafSiteFilters,
} from "@/lib/caf-filters"

/** Landing filters for CAF Monitoring (Year pre-selected). Reset uses cleared filters. */
export function getInitialCafFilters(): CafSiteFilters {
  return getLandingCafSiteFilters()
}

/** Merge selected values into options so chips remain visible. */
function withSelectedOptions(options: string[], selected: string[]): string[] {
  if (selected.length === 0) return options
  const seen = new Set(options)
  const merged = [...options]
  for (const value of selected) {
    const trimmed = String(value ?? "").trim()
    if (!trimmed || seen.has(trimmed)) continue
    seen.add(trimmed)
    merged.push(trimmed)
  }
  return merged
}

export function CafFilterBar({
  value,
  onChange,
  onReset,
  options = EMPTY_CAF_FILTER_OPTIONS,
  variant = "wallboard",
}: {
  value: CafSiteFilters
  onChange: (v: CafSiteFilters) => void
  onReset: () => void
  /** Distinct options derived from loaded site_data (preferred over /api/caf/filters). */
  options?: CafFilterOptions
  /** `stacked` — vertical grid for mobile filter drawer */
  variant?: "wallboard" | "stacked"
}) {
  const hasActiveFilters = useMemo(() => hasActiveCafFilters(value), [value])

  const projectOptions = useMemo(
    () => withSelectedOptions(options.projects, value.project_name ?? []),
    [options.projects, value.project_name]
  )
  const statusOptions = useMemo(
    () => withSelectedOptions(options.cafStatus, value.caf_status ?? []),
    [options.cafStatus, value.caf_status]
  )
  const vendorTlpOptions = useMemo(
    () => withSelectedOptions(options.vendorTlp, value.vendor_tlp_name ?? []),
    [options.vendorTlp, value.vendor_tlp_name]
  )
  const vendorRequestorOptions = useMemo(
    () => withSelectedOptions(options.vendorRequestor, value.vendor_requestor_name ?? []),
    [options.vendorRequestor, value.vendor_requestor_name]
  )
  const cafTypeOptions = useMemo(
    () => withSelectedOptions(options.cafType, value.caf_type ?? []),
    [options.cafType, value.caf_type]
  )
  const avpOptions = useMemo(
    () => withSelectedOptions(options.avp, value.avp ?? []),
    [options.avp, value.avp]
  )
  const yearOptions = useMemo(
    () => withSelectedOptions(options.year, value.year ?? []),
    [options.year, value.year]
  )

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
            options={projectOptions}
            selected={value.project_name ?? []}
            placeholder="Project"
            onChange={(selected) => onChange({ ...value, project_name: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={statusOptions}
            selected={value.caf_status ?? []}
            placeholder="CAF Status"
            onChange={(selected) => onChange({ ...value, caf_status: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={vendorTlpOptions}
            selected={value.vendor_tlp_name ?? []}
            placeholder="TLP Vendor"
            onChange={(selected) => onChange({ ...value, vendor_tlp_name: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={vendorRequestorOptions}
            selected={value.vendor_requestor_name ?? []}
            placeholder="RAN Vendor"
            onChange={(selected) => onChange({ ...value, vendor_requestor_name: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={cafTypeOptions}
            selected={value.caf_type ?? []}
            placeholder="CAF Type"
            onChange={(selected) => onChange({ ...value, caf_type: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={avpOptions}
            selected={value.avp ?? []}
            placeholder="AVP"
            onChange={(selected) => onChange({ ...value, avp: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <div className="min-w-0">
          <MultiSelect
            options={yearOptions}
            selected={value.year ?? []}
            placeholder="Year"
            onChange={(selected) => onChange({ ...value, year: selected })}
            disabled={false}
            width="w-full"
          />
        </div>
        <button
          type="button"
          onClick={onReset}
          disabled={!hasActiveFilters}
          className={`inline-flex h-9 shrink-0 items-center justify-center gap-1 rounded-md border px-2.5 text-[11px] font-semibold transition-colors ${
            isStacked ? "col-span-1 w-full sm:col-span-2" : "caf-filter-bar__reset h-6 px-2 text-[10px]"
          } ${
            hasActiveFilters
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
