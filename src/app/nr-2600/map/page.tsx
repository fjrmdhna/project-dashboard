"use client"

import { HermesDashboardMapPage } from "@/components/dashboard/HermesDashboardMapPage"
import { HERMES_DASHBOARD_NR_2600 } from "@/config/hermes-dashboards"

export default function Nr2600MapPage() {
  return <HermesDashboardMapPage config={HERMES_DASHBOARD_NR_2600} />
}
