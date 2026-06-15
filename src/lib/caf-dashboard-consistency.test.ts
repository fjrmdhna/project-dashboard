import { describe, expect, it } from "vitest"
import { aggregateCafDashboard } from "@/lib/caf-dashboard-aggregate"
import { sumMatrixPipelineBuckets } from "@/lib/caf-matrix-stats"
import type { CafFilterableRow } from "@/lib/caf-filters"

/** Synthetic dataset mirroring dominant CAF statuses from production. */
function buildProductionLikeRows(): CafFilterableRow[] {
  const statuses: Array<[string, number]> = [
    ["Approve Waiting Implementation", 12343],
    ["CAF Rejected", 3270],
    ["Waiting for Review – TLP", 2728],
    ["CAF Not Confirmed", 702],
    ["Fully Implemented", 156],
    ["Resubmit Waiting Review", 128],
    ["Unknown Legacy Status", 112],
  ]

  const rows: CafFilterableRow[] = []
  let index = 0

  for (const [status, count] of statuses) {
    for (let i = 0; i < count; i += 1) {
      index += 1
      const isImplemented = status === "Fully Implemented"
      const isApproved = status === "Approve Waiting Implementation"
      const isResubmit = status.includes("Resubmit")

      rows.push({
        caf_status: status,
        caf_type: isResubmit ? "Resubmit" : "New",
        created_date: "2026-06-01T00:00:00Z",
        approved_date: isApproved || isImplemented ? "2026-06-02T00:00:00Z" : null,
        implemented_date: isImplemented ? "2026-06-10T00:00:00Z" : null,
        status_duration: `${(index % 31) + 1} Days 0 Hours`,
      })
    }
  }

  return rows
}

describe("caf-dashboard consistency invariants", () => {
  it("keeps matrix pipeline buckets aligned with total CAF count", () => {
    const rows = buildProductionLikeRows()
    const dashboard = aggregateCafDashboard(rows)

    expect(dashboard.matrix.totalCaf).toBe(19439)
    expect(dashboard.statusFunnel.totalCaf).toBe(19439)
    expect(sumMatrixPipelineBuckets(dashboard.matrix)).toBe(19439)
  })

  it("does not double-count approved waiting as in-review", () => {
    const dashboard = aggregateCafDashboard(buildProductionLikeRows())

    expect(dashboard.matrix.approved).toBeGreaterThan(12000)
    expect(dashboard.matrix.inReview).toBeLessThan(3000)
    expect(dashboard.matrix.inReview + dashboard.matrix.approved).toBeLessThan(19439)
  })

  it("limits funnel to top statuses while total remains full dataset size", () => {
    const dashboard = aggregateCafDashboard(buildProductionLikeRows())

    expect(dashboard.statusFunnel.items.length).toBeLessThanOrEqual(10)
    expect(dashboard.statusFunnel.totalCaf).toBe(19439)
    expect(dashboard.statusFunnel.items[0]?.count).toBeGreaterThan(
      dashboard.statusFunnel.items[1]?.count ?? 0
    )
  })
})
