'use client'

import { useEffect, useId, useState, type CSSProperties } from 'react'
import { fmt } from './ModuleCard'
import { formatIdr, formatIdrFull, pct, type StatusItem } from '@/lib/sanitation-report/aggregate'
import { BAR_ORDER, COLOR, TONE_BG, TONE_GROUP } from './tones'



/**
 * Jumlah baris status inline mengikuti tinggi viewport:
 * <=680px: 2, default: 3, >=820px: 4, >=940px: 5. Sisanya lewat popover "All statuses".
 */
/** 	all: card dengan header lebih tinggi (kotak funnel PATP) sehingga baris status tampil lebih sedikit di layar pendek. */
function rowVisibility(i: number, tall: boolean | 'compact' = false): string {
  // compact: header setinggi 2 baris funnel (CAC); baris ke-2 disembunyikan hanya di layar sangat pendek.
  if (tall === 'compact') {
    if (i === 0) return 'flex'
    if (i === 1) return 'flex [@media(max-height:640px)]:hidden'
    if (i === 2) return 'hidden [@media(min-height:840px)]:flex'
    if (i === 3) return 'hidden [@media(min-height:900px)]:flex'
    return 'hidden [@media(min-height:1040px)]:flex'
  }
  if (tall) {
    if (i === 0) return 'flex [@media(max-height:560px)]:hidden'
    if (i === 1) return 'flex [@media(max-height:760px)]:hidden'
    if (i === 2) return 'hidden [@media(min-height:840px)]:flex'
    if (i === 3) return 'hidden [@media(min-height:900px)]:flex'
    return 'hidden [@media(min-height:1040px)]:flex'
  }
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
      {s.amount !== undefined && (
        <span className="w-[64px] text-right tabular-nums text-slate-600" title={formatIdrFull(s.amount)}>
          {formatIdr(s.amount)}
        </span>
      )}
    </li>
  )
}

/** Bar proporsi per kelompok warna (hijau, kuning, merah), bukan per status, supaya urutan dan warna konsisten di semua card. */
export function StatusBar({ statuses, total }: { statuses: StatusItem[]; total: number }) {
  // shrink-0: elemen tanpa konten ini tidak boleh ikut menyusut jadi 0px saat card dibatasi tinggi layar.
  if (!total) return <div className="h-1.5 shrink-0 rounded-full bg-slate-100" aria-hidden />
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
  // Teks kuning memakai warna gelap (kontras), hijau dan merah memakai putih.
  const labelColor = { green: 'text-white', yellow: 'text-slate-900', red: 'text-white' }
  return (
    <div
      className={`flex shrink-0 overflow-hidden rounded-full bg-slate-100 ${hasAmount ? 'h-4' : 'h-1.5'}`}
      role="img"
      aria-label="Status proportion"
    >
      {BAR_ORDER.filter((g) => groups[g] > 0).map((g) => {
        const share = (groups[g] / total) * 100
        const value = hasAmount ? `, ${formatIdrFull(amounts[g])}` : ''
        const label = hasAmount ? formatIdr(amounts[g]) : ''
        // Dengan nilai: lebar proporsional (flex-grow = share) tetapi tiap segmen minimal selebar labelnya,
        // sehingga segmen kecil tetap memuat angka di dalam bar dan segmen besar yang menyesuaikan.
        const sizing: CSSProperties = hasAmount
          ? { flexGrow: share, flexShrink: 1, flexBasis: 0, minWidth: `calc(${label.length}ch + 12px)` }
          : { width: `${share}%` }
        return (
          <div
            key={g}
            className={`${COLOR[g]} flex items-center justify-center overflow-hidden whitespace-nowrap text-[10px] font-semibold leading-none ${labelColor[g]}`}
            style={sizing}
            title={`${names[g]}: ${fmt(groups[g])} (${pct(groups[g], total)})${value}`}
          >
            {label}
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

  return (
    <div className="flex h-full min-h-0 flex-col">
      <StatusBar statuses={statuses} total={total} />
      <ul className="mt-1.5 space-y-0.5">
        {statuses.slice(0, 5).map((s, i) => (
          <Row key={s.label} s={s} total={total} className={rowVisibility(i, tall)} />
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
