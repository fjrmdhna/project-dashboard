import { fmt } from './ModuleCard'
import { COLOR } from './tones'
import { formatIdr, formatIdrFull, pct, type StatusItem } from '@/lib/sanitation-report/aggregate'

/** Label status GR yang dihasilkan collector (`matcGr`). Harus sama dengan scripts/sanitation-snapshot.mjs. */
const GR = {
  success: 'ACK Success',
  waiting: 'Waiting ACK',
  error: 'ACK Error',
  notSent: 'Not Sent',
} as const

const amountOfStatus = (statuses: StatusItem[], label: string) => statuses.find((s) => s.label === label)?.amount ?? 0

const countOf = (statuses: StatusItem[], label: string) => statuses.find((s) => s.label === label)?.count ?? 0

/** Satu tahap rantai Fusion PATP: hasil `aggregate()` dari satu set data (`patpGi`/`patpGr`/`patpFa`). */
export type FusionLeg = { label: string; interfaceId: string; statuses: StatusItem[] }

type LegMetrics = {
  leg: FusionLeg
  success: number
  waiting: number
  error: number
  notSent: number
  sent: number
  ackAmount: number
  detail: string
}

function legMetrics(leg: FusionLeg, total: number, basis: string, hasAmount: boolean): LegMetrics {
  const success = countOf(leg.statuses, GR.success)
  const waiting = countOf(leg.statuses, GR.waiting)
  const error = countOf(leg.statuses, GR.error)
  const notSent = countOf(leg.statuses, GR.notSent)
  const sent = total - notSent
  const ackAmount = amountOfStatus(leg.statuses, GR.success)
  const detail = [
    `${leg.label} to Oracle Fusion (${leg.interfaceId}), of ${fmt(total)} ${basis}`,
    `Sent: ${fmt(sent)} (${pct(sent, total)} of ${basis})`,
    `ACK rate: ${pct(success, sent)} (ACK Success / Sent)`,
    `ACK Success: ${fmt(success)}`,
    `Waiting ACK: ${fmt(waiting)}`,
    `ACK Error: ${fmt(error)}`,
    `Not sent: ${fmt(notSent)}`,
    ...(hasAmount ? [`BA Value of ACK Success: ${formatIdrFull(ackAmount)}`] : []),
  ].join('\n')
  return { leg, success, waiting, error, notSent, sent, ackAmount, detail }
}

function FusionBar({ sent, success, waiting, error, label }: { sent: number; success: number; waiting: number; error: number; label: string }) {
  const seg = (n: number) => (sent ? `${(n / sent) * 100}%` : '0%')
  return (
    <div
      className="flex h-1 min-w-[10px] flex-1 overflow-hidden rounded-full bg-slate-200"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={sent}
      aria-valuenow={success}
    >
      <div className={`h-full ${COLOR.green}`} style={{ width: seg(success) }} />
      <div className={`h-full ${COLOR.yellow}`} style={{ width: seg(waiting) }} />
      <div className={`h-full ${COLOR.red}`} style={{ width: seg(error) }} />
    </div>
  )
}

/**
 * Funnel Fusion untuk card PATP/MATC/CAC.
 * 1 tahap (MATC): baris flex padat yang bisa menyusut tanpa clip Rp.
 * Multi tahap (PATP/CAC): grid sejajar antar baris.
 */
export function PatpFusionMini({ legs, total, basis = 'Fully Approved PATP' }: { legs: FusionLeg[]; total: number; basis?: string }) {
  const hasAmount = legs.some((l) => l.statuses.some((s) => s.amount !== undefined))
  const rows = legs.map((leg) => legMetrics(leg, total, basis, hasAmount))

  // Satu tahap: flex wrap-safe — angka penting tidak terdorong keluar card.
  if (rows.length === 1) {
    const m = rows[0]
    return (
      <div
        className="ml-auto flex w-full min-w-0 max-w-full items-center gap-1 overflow-hidden rounded-md bg-slate-50 px-1.5 py-0.5 ring-1 ring-inset ring-slate-200/70 text-[8px] leading-3 text-slate-700"
        title={m.detail}
        aria-label={m.detail}
      >
        <span className="flex shrink-0 items-center gap-0.5 whitespace-nowrap">
          {m.leg.label}
          {m.error > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" aria-hidden />}
        </span>
        <FusionBar sent={m.sent} success={m.success} waiting={m.waiting} error={m.error} label={m.leg.label} />
        <span className="shrink-0 font-bold tabular-nums text-slate-900">{fmt(m.sent)}</span>
        <span className={`shrink-0 tabular-nums ${m.success > 0 ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
          {fmt(m.success)} ACK
        </span>
        {hasAmount && (
          <span className="min-w-0 truncate tabular-nums text-slate-600" title={m.ackAmount > 0 ? formatIdrFull(m.ackAmount) : undefined}>
            {m.ackAmount > 0 ? formatIdr(m.ackAmount) : '—'}
          </span>
        )}
      </div>
    )
  }

  // Kolom: label | bar | sent | ACK | (Rp optional). % tidak ditampilkan — ada di tooltip.
  const cols = hasAmount
    ? 'grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto_auto_auto]'
    : 'grid-cols-[minmax(0,auto)_minmax(0,1fr)_auto_auto]'
  return (
    <div className={`grid ${cols} ml-auto w-full min-w-0 max-w-full items-center gap-x-1 gap-y-px overflow-hidden rounded-md bg-slate-50 px-1.5 py-0.5 ring-1 ring-inset ring-slate-200/70`}>
      {rows.map((m) => (
        <div
          key={m.leg.label}
          className="col-span-full grid min-w-0 grid-cols-subgrid items-center text-[8px] font-normal leading-3 text-slate-700"
          title={m.detail}
          aria-label={m.detail}
        >
          <span className="flex min-w-0 items-center gap-0.5 truncate text-left">
            <span className="truncate">{m.leg.label}</span>
            {m.error > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" aria-hidden />}
          </span>
          <FusionBar sent={m.sent} success={m.success} waiting={m.waiting} error={m.error} label={m.leg.label} />
          <span className="shrink-0 text-right font-bold tabular-nums text-slate-900">{fmt(m.sent)}</span>
          <span className={`shrink-0 whitespace-nowrap text-right tabular-nums ${m.success > 0 ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
            {fmt(m.success)} ACK
          </span>
          {hasAmount && (
            <span className="max-w-[4.25rem] shrink-0 truncate text-right tabular-nums text-slate-600" title={m.ackAmount > 0 ? formatIdrFull(m.ackAmount) : undefined}>
              {m.ackAmount > 0 ? formatIdr(m.ackAmount) : '—'}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
