interface DashboardLoadingScreenProps {
  label: string
  message: string
  placeholders?: string[]
}

const DEFAULT_PLACEHOLDERS = [
  "Activation Performance",
  "Readiness Snapshot",
  "Vendor Quality",
]

export function DashboardLoadingScreen({
  label,
  message,
  placeholders = DEFAULT_PLACEHOLDERS,
}: DashboardLoadingScreenProps) {
  return (
    <div className="relative flex min-h-screen w-full flex-col items-center justify-center overflow-hidden bg-[#030a1f] text-white">
      <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden="true">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(52,211,153,0.18),_transparent_55%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom,_rgba(14,165,233,0.18),_transparent_65%)]" />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050B1B]/70 via-transparent to-[#050B1B]" />
      </div>

      <div className="relative z-10 flex w-full max-w-5xl flex-col items-center gap-10 px-6 text-center">
        <div className="flex flex-col gap-3">
          <p className="text-xs uppercase tracking-[0.65em] text-white/60">{label}</p>
          <h1 className="text-3xl font-semibold tracking-wide">Preparing Dashboard</h1>
          <p className="text-sm text-white/70">{message}</p>
        </div>

        <div className="flex flex-col items-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full border border-emerald-400/30" />
            <span className="absolute inline-flex h-[88px] w-[88px] rounded-full border border-white/10" />
            <span className="h-16 w-16 animate-spin rounded-full border-2 border-transparent border-l-emerald-300 border-t-cyan-300" />
          </div>
          <div className="w-52">
            <div className="hermes-loading-pill h-2 w-full rounded-full bg-white/20" />
            <p className="mt-3 text-xs uppercase tracking-[0.35em] text-white/60">Data Synchronization</p>
          </div>
        </div>

        <div className="grid w-full gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {placeholders.map((placeholder) => (
            <div
              key={placeholder}
              className="rounded-2xl border border-white/10 bg-white/5 p-5 text-left backdrop-blur-xl"
            >
              <p className="text-[11px] uppercase tracking-[0.35em] text-white/60">{placeholder}</p>
              <div className="mt-4 space-y-3">
                <div className="hermes-loading-pill h-8 w-full rounded-xl bg-white/10" />
                <div className="hermes-loading-pill h-2 w-3/4 rounded-full bg-white/10" />
                <div className="flex items-center gap-3 text-[11px] text-white/50">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300/80" />
                  <span>Retrieving latest metrics...</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
