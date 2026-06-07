"use client"

import { HermesDashboardPage } from "@/components/dashboard/HermesDashboardPage"
import { HERMES_DASHBOARD_HERMES_5G } from "@/config/hermes-dashboards"

export default function Hermes5GPage() {
  return <HermesDashboardPage config={HERMES_DASHBOARD_HERMES_5G} />
}
