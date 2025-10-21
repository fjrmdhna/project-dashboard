import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "AOP Dashboard",
  description: "Actionable Operations Planning workspace",
}

export default function AOPLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050B1B] text-white">
      {children}
    </div>
  )
}
