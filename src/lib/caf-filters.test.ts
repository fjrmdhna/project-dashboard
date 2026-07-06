import { describe, expect, it } from "vitest"
import {
  cafFiltersToQueryString,
  parseCafFiltersFromSearchParams,
  rowMatchesCafFilters,
} from "@/lib/caf-filters"

describe("caf-filters", () => {
  it("round-trips filters through query string", () => {
    const original = {
      project_name: ["Hermes H1 2026", "Initial 5G 2.6GHz"],
      vendor_tlp_name: ["Dayamitra Telekomunikasi"],
      caf_status: ["CAF Rejected"],
    }

    const qs = cafFiltersToQueryString(original)
    const parsed = parseCafFiltersFromSearchParams(new URLSearchParams(qs))

    expect(parsed.project_name).toEqual(original.project_name)
    expect(parsed.vendor_tlp_name).toEqual(original.vendor_tlp_name)
    expect(parsed.caf_status).toEqual(original.caf_status)
  })

  it("matches search query across caf_number and site fields", () => {
    const row = {
      caf_number: "CAF2606PTHWI01240",
      site_id_indosat: "12JKP0414",
      site_name: "IN_L_DEPKEU_MT",
    }

    expect(rowMatchesCafFilters(row, { q: "caf2606" })).toBe(true)
    expect(rowMatchesCafFilters(row, { q: "depkeu" })).toBe(true)
    expect(rowMatchesCafFilters(row, { q: "not-found" })).toBe(false)
  })

  it("uses case-insensitive matching for project_name", () => {
    const row = { project_name: "Hermes H1 2026" }
    expect(rowMatchesCafFilters(row, { project_name: ["hermes h1 2026"] })).toBe(true)
    expect(rowMatchesCafFilters(row, { project_name: ["Other"] })).toBe(false)
  })

  it("filters rows by rfs_af year", () => {
    const row2025 = { rfs_af: "2025-06-15" }
    const row2026 = { rfs_af: "2026-01-07" }

    expect(rowMatchesCafFilters(row2025, { year: ["2025"] })).toBe(true)
    expect(rowMatchesCafFilters(row2026, { year: ["2025"] })).toBe(false)
    expect(rowMatchesCafFilters(row2026, { year: ["2026"] })).toBe(true)
    expect(rowMatchesCafFilters({ rfs_af: null }, { year: ["2026"] })).toBe(false)
  })

  it("round-trips year filter through query string", () => {
    const original = { year: ["2025", "2026"] }
    const qs = cafFiltersToQueryString(original)
    const parsed = parseCafFiltersFromSearchParams(new URLSearchParams(qs))
    expect(parsed.year).toEqual(original.year)
  })
})
