import type { Metadata } from "next"
import { FilterProvider } from '@/contexts/FilterContext'
import { HERMES_DASHBOARD_HERMES_5G } from "@/config/hermes-dashboards"

export const metadata: Metadata = {
  title: "Hermes 5G Dashboard",
  description: "High-performance 5G site monitoring and management system",
}

export default function Hermes5GLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <FilterProvider storageKey={HERMES_DASHBOARD_HERMES_5G.filterStorageKey}>
      {children}
    </FilterProvider>
  )
} 