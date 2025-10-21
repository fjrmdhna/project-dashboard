import Link from "next/link"

interface ProgramHeaderProps {
  title: string
  dateLabel?: string
  overviewLabel?: string
  mapLabel?: string
  mapHref?: string
  backHref?: string
}

export function ProgramHeader({
  title,
  dateLabel,
  overviewLabel = "Overview",
  mapLabel = "Map",
  mapHref,
  backHref = "/"
}: ProgramHeaderProps) {
  const formattedDate =
    dateLabel ??
    new Date().toLocaleDateString("id-ID", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric"
    })

  return (
    <div className="flex h-full w-full items-center justify-between px-4">
      <div className="flex flex-shrink-0 items-center gap-3">
        <Link
          href={backHref}
          className="group -ml-9 mt-3 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-white/10 transition hover:border-white/30 hover:bg-white/20"
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
        <img src="/logo indosat putih.png" alt="Indosat Logo" className="h-8" />
      </div>

      <div className="flex-grow text-center">
        <h1 className="text-3xl font-bold uppercase tracking-wide text-white">{title}</h1>
      </div>

      <div className="-mr-9 mt-2 flex flex-col items-end gap-2 text-right">
        <div className="text-sm font-medium text-white">{formattedDate}</div>
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.32em]">
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
          ) : (
            <span className="rounded-full border border-white/10 px-3 py-1 font-medium text-white/40">
              {mapLabel}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
