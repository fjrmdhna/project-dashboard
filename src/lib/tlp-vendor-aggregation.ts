export const TLP_VENDOR_OTHERS_LABEL = "Others"

export type TlpVendorPlanActual = {
  vendor: string
  plan: number
  actual: number
}

/** Top N vendors by actual RFI, remaining vendors rolled into a single Others row. */
export function buildTopVendorsWithOthers(
  vendors: TlpVendorPlanActual[],
  topN: number,
  othersLabel = TLP_VENDOR_OTHERS_LABEL
): TlpVendorPlanActual[] {
  const sorted = [...vendors].sort(
    (a, b) => b.actual - a.actual || b.plan - a.plan || a.vendor.localeCompare(b.vendor)
  )

  const top = sorted.slice(0, topN)
  const rest = sorted.slice(topN)

  if (rest.length === 0) {
    return top
  }

  const others: TlpVendorPlanActual = {
    vendor: othersLabel,
    plan: rest.reduce((sum, row) => sum + row.plan, 0),
    actual: rest.reduce((sum, row) => sum + row.actual, 0),
  }

  return [...top, others]
}

/** Keep Others as the last category for chart display. */
export function sortVendorsChartRows(rows: TlpVendorPlanActual[]): TlpVendorPlanActual[] {
  const top = rows.filter((row) => row.vendor !== TLP_VENDOR_OTHERS_LABEL)
  const others = rows.find((row) => row.vendor === TLP_VENDOR_OTHERS_LABEL)

  const sortedTop = [...top].sort(
    (a, b) => b.actual - a.actual || b.plan - a.plan || a.vendor.localeCompare(b.vendor)
  )

  return others ? [...sortedTop, others] : sortedTop
}
