import Link from "next/link"
import { ReactNode } from "react"

interface ProgramHeaderProps {
  title: string
  dateLabel?: string
  overviewLabel?: string
  mapLabel?: string
  mapHref?: string
  backHref?: string
  exportButton?: ReactNode
}

export function ProgramHeader({
  title,
  dateLabel,
  overviewLabel = "Overview",
  mapLabel = "Map",
  mapHref,
  backHref = "/",
  exportButton,
}: ProgramHeaderProps) {
  const formattedDate =
    dateLabel ??
    new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    })

  return (
    <div className="program-header grid h-full w-full grid-cols-[auto_minmax(0,1fr)_auto] grid-rows-[auto_auto] items-center gap-x-3 gap-y-0.5 px-4 py-1">
      <div className="col-start-1 row-span-2 flex items-center gap-3 self-center">
        <Link
          href={backHref}
          className="group flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:border-white/30 hover:bg-white/20"
          aria-label="Back to dashboard landing"
        >
          <svg
            className="h-4 w-4 text-white transition group-hover:text-white/90"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <img src="/logo-indosat-putih.png" alt="Indosat Logo" className="h-8 shrink-0" />
      </div>

      <h1 className="col-start-2 row-span-2 self-center text-center text-3xl font-bold uppercase tracking-wide text-white">
        {title}
      </h1>

      <div className="col-start-3 row-start-1 shrink-0 text-right text-sm font-medium leading-tight text-white">
        {formattedDate}
      </div>

      <div className="col-start-3 row-start-2 flex shrink-0 items-center justify-end gap-2 text-[11px] uppercase tracking-[0.32em]">
        {exportButton}
        <span className="rounded-full border border-[#34D399] bg-[#34D399]/10 px-3 py-1 font-semibold text-[#34D399]">
          {overviewLabel}
        </span>
        {mapHref ? (
          <Link
            href={mapHref}
            className="rounded-full border border-white/20 px-3 py-1 font-medium text-white/80 transition hover:bg-white/10"
          >
            {mapLabel}
          </Link>
        ) : null}
      </div>
    </div>
  )
}
