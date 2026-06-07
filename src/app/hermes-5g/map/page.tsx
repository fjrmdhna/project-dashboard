"use client"

import { HermesDashboardMapPage } from "@/components/dashboard/HermesDashboardMapPage"
import { HERMES_DASHBOARD_HERMES_5G } from "@/config/hermes-dashboards"

export default function Hermes5GMapPage() {
  return <HermesDashboardMapPage config={HERMES_DASHBOARD_HERMES_5G} />
}
