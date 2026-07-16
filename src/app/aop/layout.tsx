import type { Metadata } from "next"
import { AOP_DASHBOARD_DEFAULT } from "@/config/aop-dashboards"

export const metadata: Metadata = {
  title: `${AOP_DASHBOARD_DEFAULT.label} Dashboard`,
  description: `${AOP_DASHBOARD_DEFAULT.label} workspace`,
}

export default function AopLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-[#050B1B] text-white">
      {children}
    </div>
  )
}
