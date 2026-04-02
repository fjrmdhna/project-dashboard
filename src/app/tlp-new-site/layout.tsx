import type { Metadata } from "next"
import { FilterProvider } from "@/contexts/FilterContext"

export const metadata: Metadata = {
  title: "TLP New Site Dashboard",
  description: "TLP New Site dashboard placeholder layout",
}

export default function TlpNewSiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <FilterProvider>{children}</FilterProvider>
}
