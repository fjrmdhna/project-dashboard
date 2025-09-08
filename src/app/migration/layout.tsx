import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Data Migration Dashboard",
  description: "Migrate data from Supabase to local PostgreSQL database",
}

export default function MigrationLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      {children}
    </div>
  )
} 