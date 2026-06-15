import { NextResponse } from "next/server"
import { parseCafFiltersFromRequest } from "@/lib/caf-data-fetch"
import { getCafDashboardData } from "@/lib/caf-dashboard-server"

export async function GET(request: Request) {
  try {
    const filters = parseCafFiltersFromRequest(request)
    const data = await getCafDashboardData(filters)

    return NextResponse.json({
      status: "success",
      data,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load CAF dashboard data",
        error: message,
      },
      { status: 500 }
    )
  }
}
