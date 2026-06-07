import type { Metadata } from "next"
import { FilterProvider } from "@/contexts/FilterContext"
import { HERMES_DASHBOARD_NR_2600 } from "@/config/hermes-dashboards"

export const metadata: Metadata = {
  title: "NR 2600 Dashboard",
  description: "NR 2600 site monitoring and management system",
}

export default function Nr2600Layout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FilterProvider storageKey={HERMES_DASHBOARD_NR_2600.filterStorageKey}>
      {children}
    </FilterProvider>
  )
}
