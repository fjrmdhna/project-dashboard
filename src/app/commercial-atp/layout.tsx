import type { Metadata } from "next"
import { FilterProvider } from "@/contexts/FilterContext"

export const metadata: Metadata = {
  title: "Commercial ATP Dashboard",
  description: "Commercial ATP site monitoring and management",
}

export default function CommercialATPLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <FilterProvider>{children}</FilterProvider>
}
