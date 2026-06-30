import { NextResponse } from "next/server"
import { unstable_cache } from "next/cache"
import { fetchTlpDashboardBaseRows } from "@/lib/tlp-dashboard-server"

const getCachedTlpDashboardRows = unstable_cache(
  async () => fetchTlpDashboardBaseRows(),
  ["tlp-dashboard-base-rows-v1"],
  { revalidate: 120 }
)

export async function GET() {
  try {
    const data = await getCachedTlpDashboardRows()

    return NextResponse.json({
      status: "success",
      data,
      rowCount: data.length,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error"
    return NextResponse.json(
      {
        status: "error",
        message: "Failed to load TLP site data",
        error: message,
      },
      { status: 500 }
    )
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
