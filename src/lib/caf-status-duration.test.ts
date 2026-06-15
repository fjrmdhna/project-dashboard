import { describe, expect, it } from "vitest"
import { classifyAgingBucket, parseStatusDurationDays } from "@/lib/caf-status-duration"

describe("caf-status-duration", () => {
  it("parses duration strings", () => {
    expect(parseStatusDurationDays("8 Days 9 Hours")).toBe(8)
    expect(parseStatusDurationDays("0 Days 0 Hours")).toBe(0)
    expect(parseStatusDurationDays(null)).toBeNull()
    expect(parseStatusDurationDays("invalid")).toBeNull()
  })

  it("classifies aging buckets inclusively at boundaries", () => {
    expect(classifyAgingBucket(7)).toBe("under7")
    expect(classifyAgingBucket(8)).toBe("days8to14")
    expect(classifyAgingBucket(14)).toBe("days8to14")
    expect(classifyAgingBucket(15)).toBe("days15to30")
    expect(classifyAgingBucket(31)).toBe("over30")
  })
})
