import { NextResponse } from "next/server"
import { parseCafFiltersFromRequest } from "@/lib/caf-data-fetch"
import { getCafDashboardData } from "@/lib/caf-dashboard-server"

export async function GET(request: Request) {
  try {
    const filters = parseCafFiltersFromRequest(request)
    const { statusFunnel } = await getCafDashboardData(filters)

    return NextResponse.json({
      status: "success",
      data: statusFunnel,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load CAF status funnel",
        error: message,
      },
      { status: 500 }
    )
  }
}
