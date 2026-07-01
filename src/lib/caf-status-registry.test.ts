import { describe, expect, it } from "vitest"
import { computeCafStatusBreakdown, resolveCafStatusId } from "@/lib/caf-status-registry"
import type { CafFilterableRow } from "@/lib/caf-filters"

describe("resolveCafStatusId", () => {
  it("maps canonical pipeline labels to ids 1–10 in workflow order", () => {
    expect(resolveCafStatusId("Waiting for Confirmation - Staff")).toBe(1)
    expect(resolveCafStatusId("Waiting for Review – TLP")).toBe(2)
    expect(resolveCafStatusId("Waiting for Confirmation - Site Management")).toBe(3)
    expect(resolveCafStatusId("Waiting for Approval - TLP")).toBe(4)
    expect(resolveCafStatusId("Waiting Fully Implemented - AVP")).toBe(5)
    expect(resolveCafStatusId("Approve Waiting Implementation")).toBe(6)
    expect(resolveCafStatusId("Waiting Fully Implemented - TLP")).toBe(7)
    expect(resolveCafStatusId("Fully Implemented")).toBe(8)
    expect(resolveCafStatusId("CAF Rejected")).toBe(9)
    expect(resolveCafStatusId("CAF Not Confirmed")).toBe(10)
  })

  it("folds legacy branch labels into nearest pipeline step", () => {
    expect(resolveCafStatusId("CAF Basic")).toBe(2)
    expect(resolveCafStatusId("Waiting for CAF Scenario – PM Vendor")).toBe(3)
    expect(resolveCafStatusId("PM Vendor Approval")).toBe(4)
    expect(resolveCafStatusId("Resubmit Waiting Review")).toBe(1)
  })

  it("returns 0 for unknown labels", () => {
    expect(resolveCafStatusId("Unknown Legacy Status")).toBe(0)
  })
})

describe("computeCafStatusBreakdown", () => {
  it("sums all mapped and unknown rows to total CAF", () => {
    const rows: CafFilterableRow[] = [
      { caf_status: "Approve Waiting Implementation" },
      { caf_status: "CAF Rejected" },
      { caf_status: "Waiting for Review – TLP" },
      { caf_status: "Unknown Legacy Status" },
    ]

    const breakdown = computeCafStatusBreakdown(rows)
    const mappedTotal = breakdown.byStatus.reduce((sum, item) => sum + item.count, 0)

    expect(breakdown.totalCaf).toBe(4)
    expect(mappedTotal + breakdown.unknown).toBe(4)
    expect(breakdown.byStatus.find((item) => item.id === 6)?.count).toBe(1)
    expect(breakdown.unknown).toBe(1)
  })
})
