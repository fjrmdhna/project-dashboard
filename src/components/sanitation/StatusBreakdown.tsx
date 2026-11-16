'use client'

import { useEffect, useId, useState, type CSSProperties } from 'react'
import { fmt } from './ModuleCard'
import { formatIdr, formatIdrFull, pct, type StatusItem } from '@/lib/sanitation-report/aggregate'
import { BAR_ORDER, COLOR, TONE_BG, TONE_GROUP } from './tones'

/**
 * Jumlah baris status inline mengikuti tinggi viewport:
 * <=680px: 2, default: 3, >=820px: 4, >=940px: 5. Sisanya lewat popover "All statuses".
 */
/** tall/compact: atur berapa baris status inline yang tampil (PATP tall ditangani terpisah di StatusBreakdown). */
function rowVisibility(i: number, tall: boolean | 'compact' = false): string {
  // compact: header setinggi 2 baris funnel (CAC); baris ke-2 disembunyikan hanya di layar sangat pendek.
  if (tall === 'compact') {
    if (i === 0) return 'flex'
    if (i === 1) return 'flex [@media(max-height:640px)]:hidden'
    if (i === 2) return 'hidden [@media(min-height:840px)]:flex'
    if (i === 3) return 'hidden [@media(min-height:900px)]:flex'
    return 'hidden [@media(min-height:1040px)]:flex'
  }
  if (i < 2) return 'flex'
  if (i === 2) return 'flex [@media(max-height:680px)]:hidden'
  if (i === 3) return 'hidden [@media(min-height:820px)]:flex'
  return 'hidden [@media(min-height:940px)]:flex'
}

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
    <li className={`${className} min-w-0 items-center gap-1.5 text-[11px] leading-4 text-slate-700`}>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_BG[s.tone]}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={s.label}>
        {shown}
      </span>
      <span className="w-12 shrink-0 text-right font-bold tabular-nums text-slate-900">{fmt(s.count)}</span>
      <span className="w-8 shrink-0 text-right tabular-nums text-slate-500">{pct(s.count, total)}</span>
      {showAmountCol && (
        <span
          className="w-[4.75rem] shrink-0 truncate text-right tabular-nums text-slate-600"
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
  if (!total) return <div className="h-3.5 shrink-0 rounded-full bg-slate-100" aria-hidden />
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
    <div className="flex h-3.5 shrink-0 overflow-hidden rounded-full bg-slate-100" role="img" aria-label="Status proportion">
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
            <span className="flex w-full items-center justify-center overflow-hidden px-0.5 whitespace-nowrap text-[9px] font-semibold leading-none tabular-nums">
              {label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

/** Popover menutupi card induk (card harus `relative`), jadi tidak terpotong dan tidak menambah scroll halaman. */
export function StatusBreakdown({ statuses, total, title, tall = false }: { statuses: StatusItem[]; total: number; title: string; tall?: boolean | 'compact' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  if (!total) return <p className="text-[11px] text-slate-500">No transactions for the selected vendors.</p>

  const showAmountCol = statuses.some((s) => s.amount !== undefined)
  const isTall = tall === true

  return (
    <div className={`flex h-full min-h-0 flex-col overflow-hidden ${isTall ? 'gap-0.5' : 'gap-1'}`}>
      <StatusBar statuses={statuses} total={total} />
      {/* PATP (tall): 1 baris status tinggi alami (tidak di-clip); All statuses didorong ke bawah. */}
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        {isTall ? (
          <>
            {/* Status + All statuses digabung di atas agar keduanya tidak terpotong overflow card. */}
            <ul className="shrink-0">
              {statuses.slice(0, 1).map((s) => (
                <Row key={s.label} s={s} total={total} showAmountCol={showAmountCol} className="flex" />
              ))}
            </ul>
            {statuses.length > 2 && (
              <button
                type="button"
                onClick={() => setOpen(true)}
                aria-haspopup="dialog"
                aria-expanded={open}
                aria-controls={id}
                className="mt-1 shrink-0 self-start rounded text-[10px] font-semibold leading-4 text-teal-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                All statuses ({statuses.length}) →
              </button>
            )}
            <div className="min-h-0 flex-1" aria-hidden />
          </>
        ) : (
          <>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ul className="space-y-1">
                {statuses.slice(0, 5).map((s, i) => (
                  <Row key={s.label} s={s} total={total} showAmountCol={showAmountCol} className={rowVisibility(i, tall)} />
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
                className="mt-0.5 shrink-0 self-start rounded text-[10px] font-semibold leading-4 text-teal-700 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                All statuses ({statuses.length}) →
              </button>
            )}
          </>
        )}
      </div>

      {open && (
        <div
          id={id}
          role="dialog"
          aria-label={`${title} – all statuses`}
          className="absolute inset-0 z-10 flex flex-col bg-white pl-4 pr-4 pt-2 pb-2.5"
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
              <Row key={s.label} s={s} total={total} showAmountCol={showAmountCol} />
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
