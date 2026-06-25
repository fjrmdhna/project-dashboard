"use client"

import { Download } from "lucide-react"

const EXPORT_BUTTON_CLASS =
  "inline-flex items-center gap-1.5 rounded-full border border-emerald-400/40 bg-emerald-400/10 px-3 py-1 text-[11px] font-semibold text-emerald-100 transition hover:bg-emerald-400/20 disabled:cursor-not-allowed disabled:opacity-60 uppercase tracking-[0.32em]"

export function DashboardExportButton({
  onClick,
  disabled = false,
  isExporting = false,
}: {
  onClick: () => void
  disabled?: boolean
  isExporting?: boolean
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || isExporting}
      className={EXPORT_BUTTON_CLASS}
      title={isExporting ? "Exporting..." : "Export to Excel"}
    >
      <Download className="h-3 w-3" />
      {isExporting ? "Exporting..." : "Export"}
    </button>
  )
}

/** Trigger browser download from an export API response. */
export async function downloadExportResponse(
  response: Response,
  fallbackFilename: string
): Promise<void> {
  if (!response.ok) {
    let errorMessage = "Failed to export data."
    const contentType = response.headers.get("Content-Type") || ""

    try {
      if (contentType.includes("application/json")) {
        const payload = await response.json()
        if (payload?.message) errorMessage = payload.message
      } else {
        const text = await response.text()
        if (text) errorMessage = text
      }
    } catch {
      // use default message
    }

    throw new Error(errorMessage)
  }

  const blob = await response.blob()
  const disposition =
    response.headers.get("Content-Disposition") ||
    response.headers.get("content-disposition")
  let filename = fallbackFilename

  if (disposition) {
    const match = disposition.match(/filename="?([^";]+)"?/i)
    if (match?.[1]) filename = match[1]
  }

  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.setAttribute("download", filename)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}
