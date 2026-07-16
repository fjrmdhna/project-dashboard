"use client"

import { AopDashboardMapPage } from "@/components/dashboard/AopDashboardMapPage"
import { AOP_DASHBOARD_DEFAULT } from "@/config/aop-dashboards"

export default function AopMapPage() {
  return <AopDashboardMapPage config={AOP_DASHBOARD_DEFAULT} />
}
