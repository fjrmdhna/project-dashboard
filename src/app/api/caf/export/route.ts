import { NextRequest, NextResponse } from "next/server"
import * as XLSX from "xlsx"
import { parseCafFiltersFromSearchParams } from "@/lib/caf-filters"
import { fetchAllCafRows } from "@/lib/caf-data-fetch"

const EXPORT_ROW_LIMIT = 50_000

function formatDateValue(value: unknown): unknown {
  if (typeof value !== "string") return value

  const trimmed = value.trim()
  if (!trimmed) return ""

  if (!/^\d{4}-\d{2}-\d{2}/.test(trimmed)) return value

  const datePart = trimmed.split(/[T\s]/)[0]
  const [year, month, day] = datePart.split("-")
  if (!year || !month || !day) return value

  return `${day.padStart(2, "0")}-${month.padStart(2, "0")}-${year}`
}

function toWorkbookBuffer(rows: Record<string, unknown>[]) {
  if (rows.length === 0) {
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([["No data matching current filters"]])
    XLSX.utils.book_append_sheet(workbook, worksheet, "CAF")
    return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })
  }

  const headers = Object.keys(rows[0]).sort((a, b) => a.localeCompare(b))
  const normalizedRows = rows.map((row) => {
    const normalized: Record<string, unknown> = {}
    for (const header of headers) {
      normalized[header] = formatDateValue(row[header])
    }
    return normalized
  })

  const worksheet = XLSX.utils.json_to_sheet(normalizedRows, { header: headers })
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "CAF")
  return XLSX.write(workbook, { bookType: "xlsx", type: "buffer" })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const filters = parseCafFiltersFromSearchParams(searchParams)
    const rows = await fetchAllCafRows(filters, "*")
    const limited = rows.slice(0, EXPORT_ROW_LIMIT) as Record<string, unknown>[]
    const buffer = toWorkbookBuffer(limited)

    const timestamp = new Date().toISOString().replace(/[:T]/g, "-").split(".")[0]
    const filename = `caf-export-${timestamp}.xlsx`

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    })
  } catch (error) {
    console.error("[caf/export] Unexpected error", error)
    return NextResponse.json(
      { status: "error", message: "Unexpected error while generating export." },
      { status: 500 }
    )
  }
}

export const runtime = "nodejs"
export const dynamic = "force-dynamic"
