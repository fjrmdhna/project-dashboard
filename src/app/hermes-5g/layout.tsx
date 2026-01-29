import type { Metadata } from "next"
import { FilterProvider } from '@/contexts/FilterContext'

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
    <FilterProvider>
      {children}
    </FilterProvider>
  )
} 