'use client'

import { useEffect, useId, useState } from 'react'
import { fmt } from './ModuleCard'
import { pct, type StatusItem } from '@/lib/sanitation-report/aggregate'
import type { Tone } from '@/lib/sanitation-report/types'

export const TONE_BG: Record<Tone, string> = {
  ok: 'bg-emerald-600',
  wait: 'bg-amber-500',
  bad: 'bg-rose-600',
  neutral: 'bg-slate-400',
}

/**
 * Jumlah baris status inline mengikuti tinggi viewport:
 * <=680px: 2, default: 3, >=820px: 4, >=940px: 5. Sisanya lewat popover "All statuses".
 */
function rowVisibility(i: number): string {
  if (i < 2) return 'flex'
  if (i === 2) return 'flex [@media(max-height:680px)]:hidden'
  if (i === 3) return 'hidden [@media(min-height:820px)]:flex'
  return 'hidden [@media(min-height:940px)]:flex'
}

function Row({ s, total, className = 'flex' }: { s: StatusItem; total: number; className?: string }) {
  return (
    <li className={`${className} items-center gap-2 text-[11px] leading-4 text-slate-700`}>
      <span className={`h-2 w-2 shrink-0 rounded-full ${TONE_BG[s.tone]}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={s.label}>
        {s.label}
      </span>
      <span className="font-bold tabular-nums text-slate-900">{fmt(s.count)}</span>
      <span className="w-8 text-right tabular-nums text-slate-500">{pct(s.count, total)}</span>
    </li>
  )
}

export function StatusBar({ statuses, total }: { statuses: StatusItem[]; total: number }) {
  if (!total) return <div className="h-1.5 rounded-full bg-slate-100" aria-hidden />
  return (
    <div className="flex h-1.5 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Status proportion">
      {statuses.map((s) => (
        <div
          key={s.label}
          className={TONE_BG[s.tone]}
          style={{ width: `${(s.count / total) * 100}%` }}
          title={`${s.label}: ${fmt(s.count)} (${pct(s.count, total)})`}
        />
      ))}
    </div>
  )
}

/** Popover menutupi card induk (card harus `relative`), jadi tidak terpotong dan tidak menambah scroll halaman. */
export function StatusBreakdown({ statuses, total, title }: { statuses: StatusItem[]; total: number; title: string }) {
  const [open, setOpen] = useState(false)
  const id = useId()

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!total) return <p className="text-[11px] text-slate-500">No transactions for the selected vendors.</p>

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StatusBar statuses={statuses} total={total} />
      <ul className="mt-1.5 space-y-0.5">
        {statuses.slice(0, 5).map((s, i) => (
          <Row key={s.label} s={s} total={total} className={rowVisibility(i)} />
        ))}
      </ul>
      {statuses.length > 2 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          className="mt-auto self-start rounded text-[11px] font-semibold text-teal-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          All statuses ({statuses.length}) →
        </button>
      )}

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={`${title} – all statuses`}
          className="absolute inset-0 z-10 flex flex-col bg-white px-3 py-2 pl-4"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-700">{title} · all statuses</span>
            <button
              type="button"
              autoFocus
              onClick={() => setOpen(false)}
              aria-label="Close"
              className="rounded px-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              ×
            </button>
          </div>
          <ul className="min-h-0 flex-1 space-y-1 overflow-auto">
            {statuses.map((s) => (
              <Row key={s.label} s={s} total={total} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
