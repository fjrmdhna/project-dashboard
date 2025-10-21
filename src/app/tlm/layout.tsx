import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "TLM Dashboard",
  description: "Tower Lifecycle Management program workspace",
}

export default function TLMLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050B1B] text-white">
      {children}
    </div>
  )
}
