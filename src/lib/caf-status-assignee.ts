import type { CafFilterableRow } from "@/lib/caf-filters"

export type CafAssigneeKind = "tlp_vendor" | "ran_vendor" | "staff" | "avp"

export function resolveCafStatusAssigneeKind(status: string): CafAssigneeKind {
  const normalized = status.trim().toLowerCase()

  if (normalized.includes("confirmation - staff") || normalized.includes("confirm - staff")) {
    return "staff"
  }
  if (normalized.includes("avp")) {
    return "avp"
  }
  if (normalized.includes("site management") || normalized.includes("site mgmt")) {
    return "tlp_vendor"
  }
  if (normalized.includes("review") && normalized.includes("tlp")) {
    return "tlp_vendor"
  }

  return "tlp_vendor"
}

export function getCafStatusAssigneeLabel(kind: CafAssigneeKind): string {
  switch (kind) {
    case "staff":
      return "Staff"
    case "avp":
      return "AVP"
    case "ran_vendor":
      return "RAN Vendor"
    case "tlp_vendor":
      return "TLP Vendor"
  }
}

export function getCafRowAssigneeName(
  row: Pick<CafFilterableRow, "vendor_tlp_name" | "vendor_requestor_name" | "staff" | "avp">,
  kind: CafAssigneeKind
): string {
  const pick = (value: string | null | undefined) => (value ?? "").trim() || "Unassigned"

  switch (kind) {
    case "staff":
      return pick(row.staff)
    case "avp":
      return pick(row.avp)
    case "ran_vendor":
      return pick(row.vendor_requestor_name)
    case "tlp_vendor":
      return pick(row.vendor_tlp_name)
  }
}
