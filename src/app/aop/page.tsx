"use client"

import { AopDashboardPage } from "@/components/dashboard/AopDashboardPage"
import { AOP_DASHBOARD_DEFAULT } from "@/config/aop-dashboards"

export default function AopPage() {
  return <AopDashboardPage config={AOP_DASHBOARD_DEFAULT} />
}
