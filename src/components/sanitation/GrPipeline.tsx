import { fmt } from './ModuleCard'
import { pct, type StatusItem } from '@/lib/sanitation-report/aggregate'

/** Label status GR yang dihasilkan collector (`matcGr`). Harus sama dengan scripts/sanitation-snapshot.mjs. */
const GR = {
  success: 'ACK Success',
  waiting: 'Waiting ACK',
  error: 'ACK Error',
  notSent: 'Not Sent',
} as const

const countOf = (statuses: StatusItem[], label: string) => statuses.find((s) => s.label === label)?.count ?? 0

function MiniRow({
  label,
  value,
  total,
  barClass,
  alert,
}: {
  label: string
  value: number
  total: number
  barClass: string
  /** Titik merah di samping label (ada ACK Error). */
  alert: boolean
}) {
  const width = total ? (value / total) * 100 : 0
  return (
    <div className="flex items-center gap-2 text-[11px] font-normal leading-4 text-slate-700">
      <span className="flex w-[46px] shrink-0 items-center gap-1 text-left">
        {label}
        {alert && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" role="img" aria-label="ACK error present" />}
      </span>
      <div
        className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
      >
        <div className={`h-full ${barClass}`} style={{ width: `${width}%` }} />
      </div>
      <span className="min-w-6 text-right font-bold tabular-nums text-slate-900">{fmt(value)}</span>
      <span className="w-8 text-right tabular-nums text-slate-500">{pct(value, total)}</span>
    </div>
  )
}

/**
 * Mini-funnel GR Material (INTINV-005) untuk baris angka card MATC (tidak menambah tinggi card).
 * Basis = BA Fully Approved (GR hanya dikirim setelah approval VP). `statuses` = hasil aggregate(matcGr).
 */
export function GrMini({ statuses, total }: { statuses: StatusItem[]; total: number }) {
  const success = countOf(statuses, GR.success)
  const waiting = countOf(statuses, GR.waiting)
  const error = countOf(statuses, GR.error)
  const notSent = countOf(statuses, GR.notSent)
  const sent = total - notSent

  const detail = [
    `GR Material to Oracle Fusion (INTINV-005), of ${fmt(total)} Fully Approved BA`,
    `Sent: ${fmt(sent)}`,
    `ACK Success: ${fmt(success)}`,
    `Waiting ACK: ${fmt(waiting)}`,
    `ACK Error: ${fmt(error)}`,
    `Not sent: ${fmt(notSent)}`,
  ].join('\n')

  return (
    <div className="w-[216px] max-w-full space-y-0.5" title={detail} aria-label={detail}>
      <MiniRow label="GR sent" value={sent} total={total} barClass="bg-sky-500" alert={false} />
      <MiniRow label="GR ACK" value={success} total={total} barClass="bg-emerald-600" alert={error > 0} />
    </div>
  )
}

/** Satu tahap rantai Fusion PATP: hasil `aggregate()` dari satu set data (`patpGi`/`patpGr`/`patpFa`). */
export type FusionLeg = { label: string; interfaceId: string; statuses: StatusItem[] }

/**
 * Funnel Fusion untuk card PATP: satu baris per tahap (GI Material, GR Service, Fixed Asset).
 * Angka = terkirim (sent) dari total PATP Fully Approved; bar dua warna menunjukkan ACK sukses (pekat),
 * menunggu ACK (muda), dan ACK error (merah). Rinciannya ada di tooltip.
 */
export function PatpFusionMini({ legs, total }: { legs: FusionLeg[]; total: number }) {
  return (
    <div className="w-[250px] max-w-full">
      {legs.map((leg) => {
        const success = countOf(leg.statuses, GR.success)
        const waiting = countOf(leg.statuses, GR.waiting)
        const error = countOf(leg.statuses, GR.error)
        const notSent = countOf(leg.statuses, GR.notSent)
        const sent = total - notSent
        const seg = (n: number) => (total ? `${(n / total) * 100}%` : '0%')
        const detail = [
          `${leg.label} to Oracle Fusion (${leg.interfaceId}), of ${fmt(total)} Fully Approved PATP`,
          `Sent: ${fmt(sent)}`,
          `ACK Success: ${fmt(success)}`,
          `Waiting ACK: ${fmt(waiting)}`,
          `ACK Error: ${fmt(error)}`,
          `Not sent: ${fmt(notSent)}`,
        ].join('\n')
        return (
          <div
            key={leg.label}
            className="flex items-center gap-1.5 text-[11px] font-normal leading-[14px] text-slate-700"
            title={detail}
            aria-label={detail}
          >
            <span className="flex w-[62px] shrink-0 items-center gap-1 whitespace-nowrap text-left">
              {leg.label}
              {error > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" role="img" aria-label="ACK error present" />}
            </span>
            <div
              className="flex h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100"
              role="progressbar"
              aria-label={leg.label}
              aria-valuemin={0}
              aria-valuemax={total}
              aria-valuenow={sent}
            >
              <div className="h-full bg-emerald-600" style={{ width: seg(success) }} />
              <div className="h-full bg-sky-300" style={{ width: seg(waiting) }} />
              <div className="h-full bg-rose-500" style={{ width: seg(error) }} />
            </div>
            <span className="w-6 text-right font-bold tabular-nums text-slate-900">{fmt(sent)}</span>
            <span className="w-7 text-right tabular-nums text-slate-500">{pct(sent, total)}</span>
            <span className={`w-[46px] text-right tabular-nums ${success > 0 ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>
              {fmt(success)} ACK
            </span>
          </div>
        )
      })}
    </div>
  )
}
