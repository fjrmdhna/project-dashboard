import { NextResponse } from "next/server"
import { getCafSiteDataRows } from "@/lib/caf-dashboard-server"

export async function GET() {
  try {
    const data = await getCafSiteDataRows()

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
        message: "Failed to load CAF site data",
        error: message,
      },
      { status: 500 }
    )
  }
}
