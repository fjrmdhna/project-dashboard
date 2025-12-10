import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "New Site Dashboard",
  description: "New Site workspace",
}

export default function NewSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050B1B] text-white">
      {children}
    </div>
  )
}
