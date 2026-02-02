import type { FilterValue } from "@/components/filters/FilterBar"

/** Keys persisted in AOP filter templates (same shape as dashboard + map). */
export const AOP_TEMPLATE_FILTER_KEYS = [
  { key: "q" as const, label: "Search" },
  { key: "vendor_name" as const, label: "Vendor" },
  { key: "program_report" as const, label: "Program" },
  { key: "circle" as const, label: "Circle" },
  { key: "site_category" as const, label: "Site Category" },
  { key: "ran_score" as const, label: "RAN Score" },
  { key: "year" as const, label: "Year" },
  { key: "priority_congest_urgent" as const, label: "Priority" },
  { key: "trial_gb_factory" as const, label: "Trial GB Factory" },
] as const

/**
 * Merge template payload into an initial filter (preserves keys not in template, e.g. status on map).
 */
export function mergeWithInitialFilter(
  initialFilter: FilterValue,
  payload: Record<string, unknown>
): FilterValue {
  const base = { ...initialFilter }
  for (const { key } of AOP_TEMPLATE_FILTER_KEYS) {
    const v = payload[key]
    if (key === "q") {
      base.q = typeof v === "string" ? v : ""
    } else if (Array.isArray(v)) {
      ;(base as unknown as Record<string, unknown>)[key] = v.filter(
        (x): x is string => typeof x === "string"
      )
    }
  }
  return base
}

/**
 * Build payload for save/update template from current filter (only template keys).
 */
export function buildTemplatePayload(filterValue: FilterValue): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  for (const { key } of AOP_TEMPLATE_FILTER_KEYS) {
    if (key === "q") {
      const v = filterValue.q?.trim()
      if (v) payload[key] = v
    } else {
      const arr = (filterValue as unknown as Record<string, unknown>)[key]
      if (Array.isArray(arr) && arr.length > 0) {
        payload[key] = arr.filter((x): x is string => typeof x === "string")
      }
    }
  }
  return payload
}
