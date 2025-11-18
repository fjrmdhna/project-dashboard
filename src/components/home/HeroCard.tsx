import { HeroHighlight } from "@/types/home"

interface HeroCardProps {
  highlight: HeroHighlight
}

export function HeroCard({ highlight }: HeroCardProps) {
  return (
    <section className="relative overflow-hidden rounded-3xl bg-white p-6 text-slate-900 shadow-xl">
      <div className="absolute inset-0 bg-gradient-to-r from-[#ff2cfb]/5 via-[#5de3db]/5 to-[#80a0ff]/10" />
      <div className="relative space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{highlight.eyebrow}</p>
        <h2 className="text-xl font-semibold leading-tight">{highlight.title}</h2>
        <p className="text-sm text-slate-500">{highlight.description}</p>
      </div>
      <button className="relative mt-5 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800">
        {highlight.actionLabel}
      </button>
      <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br from-[#ff2cfb] via-[#5de3db] to-[#80a0ff] opacity-30 blur-2xl" />
      <div className="pointer-events-none absolute -bottom-8 -left-4 h-24 w-24 rounded-full bg-primary/20 blur-2xl" />
    </section>
  )
}
