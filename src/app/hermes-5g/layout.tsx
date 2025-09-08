import type { Metadata } from "next"
import { Hermes5GProvider } from '@/contexts/Hermes5GContext'

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
    <Hermes5GProvider>
      {children}
    </Hermes5GProvider>
  )
} 