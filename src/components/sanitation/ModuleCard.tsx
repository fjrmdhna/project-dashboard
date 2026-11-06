import type { ReactNode } from 'react'

export type ModuleCardTone = 'navy' | 'cyan' | 'violet' | 'teal' | 'orange' | 'red'

const TONES: Record<ModuleCardTone, { bar: string; chip: string }> = {
  navy: { bar: 'bg-slate-900', chip: 'bg-sky-50 text-slate-700' },
  cyan: { bar: 'bg-cyan-600', chip: 'bg-cyan-50 text-cyan-800' },
  violet: { bar: 'bg-indigo-500', chip: 'bg-indigo-50 text-indigo-700' },
  teal: { bar: 'bg-teal-600', chip: 'bg-emerald-50 text-teal-800' },
  orange: { bar: 'bg-orange-500', chip: 'bg-amber-50 text-orange-700' },
  red: { bar: 'bg-rose-500', chip: 'bg-rose-50 text-rose-700' },
}

export const fmt = (n: number) => n.toLocaleString('en-US')

type Props = {
  title: string
  value: number
  unit?: string
  subValue?: string
  /** Definisi satuan hitung (tooltip). */
  hint: string
  tone: ModuleCardTone
  dimmed?: boolean
  note?: ReactNode
  /** Garis pemisah abu-abu antara baris angka dan isi card (untuk card dengan blok tambahan di samping angka). */
  divided?: boolean
  children: ReactNode
}

export function ModuleCard({ title, value, unit, subValue, hint, tone, dimmed, note, divided, children }: Props) {
  const t = TONES[tone]
  return (
    <section
      aria-label={title}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} />
      <div className={`flex min-h-0 flex-1 flex-col px-3 py-2 pl-4 ${divided ? 'gap-1' : 'gap-1.5'}`}>
        <div className="flex items-center justify-between gap-2">
          <h2 className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${t.chip}`}>{title}</h2>
          <span
            tabIndex={0}
            title={hint}
            aria-label={`Counting unit: ${hint}`}
            className="flex h-4 w-4 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            i
          </span>
        </div>
        <div className={`flex justify-between gap-2 ${divided ? 'items-center' : 'items-end'}`}>
          <div className="shrink-0 whitespace-nowrap text-slate-900">
            <span className="text-2xl font-extrabold tabular-nums leading-none">{fmt(value)}</span>
            {unit && <span className="ml-1 text-xs font-bold">{unit}</span>}
            {subValue && <span className="ml-1 text-[11px] text-slate-600">({subValue})</span>}
          </div>
          {note && <div className={`min-w-0 text-right text-[11px] font-semibold leading-tight text-slate-600 ${divided ? 'flex-1' : ''}`}>{note}</div>}
        </div>
        <div className={`min-h-0 flex-1 ${divided ? 'border-t border-slate-200 pt-1' : ''}`}>{children}</div>
      </div>
    </section>
  )
}
