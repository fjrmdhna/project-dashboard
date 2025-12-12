import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TLP New Site Dashboard",
  description: "TLP New Site workspace",
}

export default function TLPNewSiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050B1B] text-white">
      {children}
    </div>
  )
}

