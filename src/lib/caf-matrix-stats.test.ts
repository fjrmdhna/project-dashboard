import { describe, expect, it } from "vitest"
import {
  computeCafMatrixStats,
  isApprovedPendingStatus,
  isInReviewStatus,
  isRejectedStatus,
  sumMatrixPipelineBuckets,
} from "@/lib/caf-matrix-stats"
import type { CafFilterableRow } from "@/lib/caf-filters"

const sampleRows: CafFilterableRow[] = [
  {
    caf_status: "Approve Waiting Implementation",
    caf_type: "New",
    approved_date: "2026-01-01T00:00:00Z",
    implemented_date: null,
  },
  {
    caf_status: "CAF Rejected",
    caf_type: "New",
    approved_date: null,
    implemented_date: null,
  },
  {
    caf_status: "Waiting for Review – TLP",
    caf_type: "Resubmit",
    approved_date: null,
    implemented_date: null,
  },
  {
    caf_status: "Fully Implemented",
    caf_type: "New",
    approved_date: "2026-01-02T00:00:00Z",
    implemented_date: "2026-02-01T00:00:00Z",
  },
  {
    caf_status: "CAF Not Confirmed",
    caf_type: "New",
    approved_date: null,
    implemented_date: null,
  },
  {
    caf_status: "Unknown Custom Status",
    caf_type: "New",
    approved_date: null,
    implemented_date: null,
  },
]

describe("caf-matrix-stats", () => {
  it("classifies statuses without double-counting approved + waiting", () => {
    expect(isApprovedPendingStatus("approve waiting implementation")).toBe(true)
    expect(isInReviewStatus("approve waiting implementation")).toBe(false)
    expect(isRejectedStatus("caf rejected")).toBe(true)
  })

  it("assigns each row to exactly one pipeline bucket", () => {
    const stats = computeCafMatrixStats(sampleRows)
    expect(stats.totalCaf).toBe(6)
    expect(sumMatrixPipelineBuckets(stats)).toBe(6)
    expect(stats.approved).toBe(1)
    expect(stats.rejected).toBe(1)
    expect(stats.inReview).toBe(1)
    expect(stats.implemented).toBe(1)
    expect(stats.notConfirmed).toBe(1)
    expect(stats.other).toBe(1)
    expect(stats.resubmit).toBe(1)
  })

  it("prefers implemented over approved when implemented_date is set", () => {
    const stats = computeCafMatrixStats([
      {
        caf_status: "Approve Waiting Implementation",
        approved_date: "2026-01-01",
        implemented_date: "2026-02-01",
      },
    ])
    expect(stats.implemented).toBe(1)
    expect(stats.approved).toBe(0)
  })
})
