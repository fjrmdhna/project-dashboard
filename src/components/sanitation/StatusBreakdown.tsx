'use client'

import { useEffect, useId, useState, type CSSProperties } from 'react'
import { fmt } from './ModuleCard'
import { formatIdr, formatIdrFull, pct, type StatusItem } from '@/lib/sanitation-report/aggregate'
import { BAR_ORDER, COLOR, TONE_BG, TONE_GROUP } from './tones'

/** Prefiks panjang dipotong di UI; label penuh tetap di tooltip. */
function shortStatusLabel(label: string): string {
  if (label.startsWith('Approved with Punchlist - ')) return `Punchlist · ${label.slice('Approved with Punchlist - '.length)}`
  const prefixes = [
    'Acceptance Fully Approved - ',
    'Waiting Fully Implemented - ',
    'Waiting for Approval - ',
    'Waiting For Approval - ',
  ]
  for (const p of prefixes) {
    if (label.startsWith(p)) return label.slice(p.length)
  }
  return label
}

function Row({
  s,
  total,
  className = 'flex',
  showAmountCol,
}: {
  s: StatusItem
  total: number
  className?: string
  /** Cadangkan kolom Rp agar sejajar antar-card (kosong jika status tidak punya amount). */
  showAmountCol?: boolean
}) {
  const shown = shortStatusLabel(s.label)
  return (
    <li className={`${className} min-w-0 items-center gap-1 text-[10px] leading-3 text-slate-700`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_BG[s.tone]}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={s.label}>
        {shown}
      </span>
      <span className="w-11 shrink-0 text-right font-bold tabular-nums text-slate-900">{fmt(s.count)}</span>
      <span className="w-7 shrink-0 text-right tabular-nums text-slate-500">{pct(s.count, total)}</span>
      {showAmountCol && (
        <span
          className="w-[4.25rem] shrink-0 truncate text-right tabular-nums text-slate-600"
          title={s.amount !== undefined ? formatIdrFull(s.amount) : undefined}
        >
          {s.amount !== undefined ? formatIdr(s.amount) : ''}
        </span>
      )}
    </li>
  )
}

/** Bar proporsi per kelompok warna (hijau, kuning, merah), bukan per status, supaya urutan dan warna konsisten di semua card. */
export function StatusBar({ statuses, total }: { statuses: StatusItem[]; total: number }) {
  // Tinggi bar seragam; sedikit lebih tinggi saat ada label Rp agar teks muat.
  if (!total) return <div className="h-3 shrink-0 rounded-full bg-slate-100" aria-hidden />
  const groups = { green: 0, yellow: 0, red: 0 }
  const amounts = { green: 0, yellow: 0, red: 0 }
  let hasAmount = false
  for (const s of statuses) {
    groups[TONE_GROUP[s.tone]] += s.count
    if (s.amount !== undefined) {
      amounts[TONE_GROUP[s.tone]] += s.amount
      hasAmount = true
    }
  }
  const names = { green: 'Completed', yellow: 'In progress / waiting', red: 'Rejected / error' }
  const labelColor = { green: 'text-white', yellow: 'text-slate-900', red: 'text-white' }
  return (
    <div className="flex h-3 shrink-0 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Status proportion">
      {BAR_ORDER.filter((g) => groups[g] > 0).map((g) => {
        const share = (groups[g] / total) * 100
        const value = hasAmount ? `, ${formatIdrFull(amounts[g])}` : ''
        // Segmen kecil (share < 8%): label ringkas (Rp 154 B) supaya muat di zoom/DPI Windows.
        const label = hasAmount
          ? share < 8
            ? formatIdr(amounts[g]).replace(/(\d+)\.\d+/, (_, n) => n)
            : formatIdr(amounts[g])
          : ''
        // Segmen kecil tidak menyusut; segmen besar menyerap lebih agresif.
        const sizing: CSSProperties = hasAmount
          ? {
              flexGrow: Math.max(share, 0.01),
              flexShrink: share < 8 ? 0 : 4,
              flexBasis: 0,
              minWidth: `calc(${label.length}ch + 6px)`,
            }
          : { width: `${share}%` }
        return (
          <div
            key={g}
            className={`${COLOR[g]} flex min-h-full overflow-hidden ${labelColor[g]}`}
            style={sizing}
            title={`${names[g]}: ${fmt(groups[g])} (${pct(groups[g], total)})${value}`}
          >
            <span className="flex w-full items-center justify-center overflow-hidden px-0.5 whitespace-nowrap text-[8px] font-semibold leading-none tabular-nums">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/**
 * Semua baris status di-render; yang tidak muat terpotong oleh overflow card.
 * Tombol "All statuses" tetap di bawah (selalu klikable) untuk popover penuh.
 * `tall` dipertahankan agar pemanggil lama tidak rusak (tidak lagi membatasi jumlah baris).
 */
export function StatusBreakdown({ statuses, total, title, tall: _tall = false }: { statuses: StatusItem[]; total: number; title: string; tall?: boolean | 'compact' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!total) return <p className="text-[10px] text-slate-500">No transactions for the selected vendors.</p>

  const showAmountCol = statuses.some((s) => s.amount !== undefined)

  return (
    <div className="flex h-full min-h-0 flex-col gap-0.5 overflow-hidden">
      <StatusBar statuses={statuses} total={total} />
      {/* List penuh + clip; tombol All statuses di luar overflow supaya tidak ikut terpotong. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ul className="space-y-0.5">
          {statuses.map((s) => (
            <Row key={s.label} s={s} total={total} showAmountCol={showAmountCol} className="flex" />
          ))}
        </ul>
      </div>
      {statuses.length > 2 && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={id}
          className="shrink-0 self-start rounded text-[9px] font-semibold leading-3 text-teal-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          All statuses ({statuses.length}) →
        </button>
      )}

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={`${title} – all statuses`}
          className="absolute inset-0 z-10 flex flex-col bg-white pl-3 pr-3 pt-1.5 pb-2"
        >
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-700">{title} · all statuses</span>
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
              <Row key={s.label} s={s} total={total} showAmountCol={showAmountCol} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
