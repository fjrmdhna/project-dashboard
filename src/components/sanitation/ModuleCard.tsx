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
  /** Nilai Rp format siap tampil di samping angka besar (mis. "Rp 652.08 B"). */
  amountLabel?: string
  subValue?: string
  /** Definisi satuan hitung (tooltip). */
  hint: string
  tone: ModuleCardTone
  dimmed?: boolean
  note?: ReactNode
  /** Garis pemisah abu-abu antara baris angka dan isi card (untuk card dengan blok tambahan di samping angka). */
  divided?: boolean
  /** Nilai total (subValue) ditaruh di bawah angka besar, bukan di sampingnya (untuk funnel lebar di samping angka). */
  stackSub?: boolean
  children: ReactNode
}

export function ModuleCard({ title, value, unit, amountLabel, subValue, hint, tone, dimmed, note, divided, stackSub, children }: Props) {
  const t = TONES[tone]
  return (
    <section
      aria-label={title}
      className={`relative flex min-h-0 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-opacity ${
        dimmed ? 'opacity-60' : ''
      }`}
    >
      <div className={`absolute inset-y-0 left-0 w-1 ${t.bar}`} />
      <div className={`flex min-h-0 flex-1 flex-col pl-4 pr-4 pt-2 ${divided ? 'gap-1 pb-3' : 'gap-1.5 pb-2.5'}`}>
        <div className="flex shrink-0 items-center justify-between gap-2">
          <h2 className={`rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider ${t.chip}`}>{title}</h2>
          <span
            tabIndex={0}
            title={hint}
            aria-label={`Counting unit: ${hint}`}
            className="flex h-4 w-4 shrink-0 cursor-help items-center justify-center rounded-full border border-slate-300 text-[10px] font-bold text-slate-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
          >
            i
          </span>
        </div>
        {/* note/funnel boleh menyusut agar StatusBar + 1 status + All statuses tidak terpotong */}
        <div className={`flex min-h-0 min-w-0 justify-between gap-2 ${note ? 'min-h-0 shrink' : 'shrink-0'} ${divided ? 'items-center' : 'items-end'}`}>
          <div className={`min-w-0 text-slate-900 ${note ? 'max-w-[40%] shrink' : 'shrink-0 whitespace-nowrap'}`}>
            <div className="truncate whitespace-nowrap">
              <span className={`${note ? 'text-lg' : 'text-2xl'} font-extrabold tabular-nums leading-none`}>{fmt(value)}</span>
              {unit && <span className="ml-1 text-xs font-bold">{unit}</span>}
              {amountLabel && <span className="ml-1 text-[11px] font-semibold tabular-nums text-slate-600">· {amountLabel}</span>}
              {subValue && !stackSub && <span className="ml-1 text-[10px] text-slate-600">({subValue})</span>}
            </div>
            {subValue && stackSub && (
              <div className="mt-0.5 truncate text-[10px] font-normal leading-tight text-slate-600" title={subValue}>
                ({subValue})
              </div>
            )}
          </div>
          {note && <div className="min-h-0 min-w-0 flex-1 overflow-hidden text-right text-[11px] font-semibold leading-tight text-slate-600">{note}</div>}
        </div>
        {/* min-h: StatusBar + 1 row + All statuses harus selalu muat */}
        <div className={`flex min-h-[3.25rem] flex-1 flex-col overflow-hidden ${divided ? 'border-t border-slate-200 pt-1' : ''}`}>{children}</div>
      </div>
    </section>
  )
}
