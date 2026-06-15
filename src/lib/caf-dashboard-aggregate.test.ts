import { describe, expect, it } from "vitest"
import {
  aggregateCafDashboard,
  sumFunnelCounts,
} from "@/lib/caf-dashboard-aggregate"
import { sumMatrixPipelineBuckets } from "@/lib/caf-matrix-stats"
import type { CafFilterableRow } from "@/lib/caf-filters"
import { format, subDays } from "date-fns"

function buildFixtureRows(): CafFilterableRow[] {
  const today = new Date()
  const inWindow = format(subDays(today, 1), "yyyy-MM-dd")

  return [
    {
      caf_status: "Approve Waiting Implementation",
      caf_type: "New",
      approved_date: `${inWindow}T10:00:00Z`,
      implemented_date: null,
      created_date: `${inWindow}T08:00:00Z`,
      status_duration: "3 Days 2 Hours",
    },
    {
      caf_status: "CAF Rejected",
      caf_type: "New",
      created_date: `${inWindow}T09:00:00Z`,
      status_duration: "15 Days 1 Hours",
    },
    {
      caf_status: "Waiting for Review – TLP",
      caf_type: "New",
      created_date: `${inWindow}T11:00:00Z`,
      status_duration: "1 Days 0 Hours",
    },
    {
      caf_status: "Fully Implemented",
      caf_type: "New",
      implemented_date: `${inWindow}T12:00:00Z`,
      approved_date: `${inWindow}T11:30:00Z`,
      created_date: `${inWindow}T07:00:00Z`,
      status_duration: "0 Days 0 Hours",
    },
  ]
}

describe("caf-dashboard-aggregate", () => {
  it("keeps matrix, funnel, and aging totals consistent", () => {
    const rows = buildFixtureRows()
    const dashboard = aggregateCafDashboard(rows)

    expect(dashboard.matrix.totalCaf).toBe(rows.length)
    expect(dashboard.statusFunnel.totalCaf).toBe(rows.length)
    expect(sumMatrixPipelineBuckets(dashboard.matrix)).toBe(rows.length)

    const funnelSum = sumFunnelCounts(dashboard.statusFunnel.items)
    expect(funnelSum).toBe(rows.length)

    expect(dashboard.aging.totalOpen).toBe(3)
    expect(dashboard.aging.waitingImplementation).toBe(1)
    expect(dashboard.aging.pendingAging).toBe(3)
  })

  it("produces 7-day runrate series with numeric values", () => {
    const dashboard = aggregateCafDashboard(buildFixtureRows())
    expect(dashboard.dailyRunrate).toHaveLength(7)
    expect(dashboard.dailyRunrate.every((d) => typeof d.forecast === "number")).toBe(true)
    expect(dashboard.dailyRunrate.every((d) => typeof d.actual === "number")).toBe(true)
    expect(dashboard.dailyRunrate.some((d) => d.forecast > 0)).toBe(true)
  })

  it("classifies aging buckets without overlap", () => {
    const dashboard = aggregateCafDashboard(buildFixtureRows())
    const bucketTotal =
      dashboard.aging.buckets.under7 +
      dashboard.aging.buckets.days8to14 +
      dashboard.aging.buckets.days15to30 +
      dashboard.aging.buckets.over30

    expect(bucketTotal).toBe(dashboard.aging.pendingAging)
  })
})
