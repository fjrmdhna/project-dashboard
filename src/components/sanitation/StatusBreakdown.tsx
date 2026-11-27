'use client'

import { useEffect, useId, useState, type CSSProperties } from 'react'
import { fmt } from './ModuleCard'
import { formatIdr, formatIdrFull, pct, type StatusItem } from '@/lib/sanitation-report/aggregate'
import { BAR_ORDER, COLOR, TONE_BG, TONE_GROUP } from './tones'

export type StatusDrilldown = {
  title: string
  statuses: StatusItem[]
  /** Shown when statuses is empty (e.g. old snapshot). */
  emptyHint?: string
}

/** Prefiks panjang dipotong di UI; label penuh tetap di tooltip. */
function shortStatusLabel(label: string): string {
  {
    const m = label.match(/^Anomaly: (?:MOS|GREEN) without MPS ACK Success \((.+)\)$/)
    if (m) return `Anomaly · ${m[1]}`
  }
  if (/^Anomaly: (?:MOS|GREEN) without MPS export$/.test(label)) return 'Anomaly · No MPS export'
  if (label.startsWith('Anomaly: ')) return `Anomaly · ${label.slice('Anomaly: '.length)}`
  if (label === 'Backfill (no ACK expected)') return 'Backfill · no ACK expected'
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
  onClick,
}: {
  s: StatusItem
  total: number
  className?: string
  /** Cadangkan kolom Rp agar sejajar antar-card (kosong jika status tidak punya amount). */
  showAmountCol?: boolean
  onClick?: () => void
}) {
  const shown = shortStatusLabel(s.label)
  const body = (
    <>
      <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${TONE_BG[s.tone]}`} aria-hidden />
      <span className="min-w-0 flex-1 truncate" title={s.label}>
        {shown}
        {onClick ? <span className="ml-0.5 text-teal-700">→</span> : null}
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
    </>
  )
  if (onClick) {
    return (
      <li className={`${className} min-w-0`}>
        <button
          type="button"
          onClick={onClick}
          className="flex w-full min-w-0 items-center gap-1 rounded text-left text-[10px] leading-3 text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
        >
          {body}
        </button>
      </li>
    )
  }
  return (
    <li className={`${className} min-w-0 items-center gap-1 text-[10px] leading-3 text-slate-700`}>
      {body}
    </li>
  )
}

/** Bar proporsi per kelompok warna (hijau, kuning, merah), bukan per status, supaya urutan dan warna konsisten di semua card. */
export function StatusBar({
  statuses,
  total,
  showAmounts = true,
}: {
  statuses: StatusItem[]
  total: number
  /** false = bar proporsi saja (tanpa label Rp di dalam segmen; dipakai Page 2 yang card-nya lebih sempit). */
  showAmounts?: boolean
}) {
  // Tinggi bar seragam; sedikit lebih tinggi saat ada label Rp agar teks muat.
  if (!total) return <div className="h-3 shrink-0 rounded-full bg-slate-100" aria-hidden />
  const groups = { green: 0, yellow: 0, red: 0 }
  const amounts = { green: 0, yellow: 0, red: 0 }
  let hasAmount = false
  for (const s of statuses) {
    groups[TONE_GROUP[s.tone]] += s.count
    if (showAmounts && s.amount !== undefined) {
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
            {hasAmount && (
              <span className="flex w-full items-center justify-center overflow-hidden px-0.5 whitespace-nowrap text-[8px] font-semibold leading-none tabular-nums">
                {label}
              </span>
            )}
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
export function StatusBreakdown({
  statuses,
  total,
  title,
  tall: _tall = false,
  showBarAmounts = true,
  showAmountCol: showAmountColProp,
  anomalyPrefix,
  statusDrilldowns,
}: {
  statuses: StatusItem[]
  total: number
  title: string
  tall?: boolean | 'compact'
  /** false = jangan tampilkan Rp di dalam status bar (Page 2). */
  showBarAmounts?: boolean
  /** Override kolom Rp di list; default = ada amount di statuses. */
  showAmountCol?: boolean
  /** Prefiks label anomali — digroup di bawah daftar utama dengan heading Anomalies. */
  anomalyPrefix?: string
  /** Optional click drilldown per status label (e.g. Not Sent → reason list). */
  statusDrilldowns?: Record<string, StatusDrilldown>
}) {
  const [open, setOpen] = useState(false)
  const [drillLabel, setDrillLabel] = useState<string | null>(null)
  const id = useId()
  const drill = drillLabel ? statusDrilldowns?.[drillLabel] : undefined
  useEffect(() => {
    if (!open && !drillLabel) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (drillLabel) setDrillLabel(null)
      else setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, drillLabel])

  if (!total) return <p className="text-[10px] text-slate-500">No transactions for the selected vendors.</p>

  const showAmountCol = showAmountColProp ?? statuses.some((s) => s.amount !== undefined)
  const main = anomalyPrefix ? statuses.filter((s) => !s.label.startsWith(anomalyPrefix)) : statuses
  const anomalies = anomalyPrefix ? statuses.filter((s) => s.label.startsWith(anomalyPrefix)) : []
  // Bar/% hanya dari funnel utama; anomali/backfill tidak menggelembungkan proporsi.
  const barStatuses = main
  const barTotal = Math.max(
    total,
    barStatuses.reduce((sum, s) => sum + s.count, 0),
  )
  const anomalyTotal = anomalies.reduce((sum, s) => sum + s.count, 0)
  const drillTotal = drill?.statuses.reduce((sum, s) => sum + s.count, 0) ?? 0
  const drillShowAmount = drill?.statuses.some((s) => s.amount !== undefined) ?? false

  return (
    <div className="relative flex h-full min-h-0 flex-col gap-0.5 overflow-hidden">
      <StatusBar statuses={barStatuses} total={barTotal} showAmounts={showBarAmounts} />
      {/* Status normal boleh ter-clip; grup Anomalies + All statuses tetap terlihat di bawah. */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ul className="space-y-0.5">
          {main.map((s) => (
            <Row
              key={s.label}
              s={s}
              total={barTotal}
              showAmountCol={showAmountCol}
              className="flex"
              onClick={statusDrilldowns?.[s.label] ? () => setDrillLabel(s.label) : undefined}
            />
          ))}
        </ul>
      </div>
      {anomalies.length > 0 && (
        <div className="shrink-0 space-y-0.5 border-t border-slate-100 pt-1">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">
            {anomalies.every((s) => s.label.startsWith('Backfill')) ? 'Excluded' : 'Anomalies'}
          </p>
          <ul className="space-y-0.5">
            {anomalies.map((s) => (
              <Row
                key={s.label}
                s={s}
                total={anomalyTotal || s.count}
                showAmountCol={showAmountCol}
                className="flex"
              />
            ))}
          </ul>
        </div>
      )}
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
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            <ul className="space-y-1">
              {main.map((s) => (
                <Row
                  key={s.label}
                  s={s}
                  total={total}
                  showAmountCol={showAmountCol}
                  onClick={statusDrilldowns?.[s.label] ? () => { setOpen(false); setDrillLabel(s.label) } : undefined}
                />
              ))}
            </ul>
            {anomalies.length > 0 && (
              <div className="space-y-1 border-t border-slate-100 pt-1">
                <p className="text-[9px] font-bold uppercase tracking-wider text-slate-500">Anomalies</p>
                <ul className="space-y-1">
                  {anomalies.map((s) => (
                    <Row key={s.label} s={s} total={total} showAmountCol={showAmountCol} />
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}

      {drill && (
        <div
          role="dialog"
          aria-label={drill.title}
          className="absolute inset-0 z-20 flex flex-col bg-white pl-3 pr-3 pt-1.5 pb-2"
        >
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-[10px] font-bold uppercase tracking-wider text-slate-700">
              {drill.title}
            </span>
            <button
              type="button"
              autoFocus
              onClick={() => setDrillLabel(null)}
              aria-label="Close"
              className="rounded px-1.5 text-sm font-bold text-slate-600 hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              ×
            </button>
          </div>
          <div className="min-h-0 flex-1 space-y-1 overflow-auto">
            {drill.statuses.length === 0 ? (
              <p className="text-[10px] text-slate-500">{drill.emptyHint || 'No breakdown available.'}</p>
            ) : (
              <ul className="space-y-1">
                {drill.statuses.map((s) => (
                  <Row
                    key={s.label}
                    s={s}
                    total={drillTotal || s.count}
                    showAmountCol={drillShowAmount}
                  />
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
