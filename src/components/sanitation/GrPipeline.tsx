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

/**
 * Funnel Fusion untuk card PATP: satu baris per tahap (GI Material, GR Service, Fixed Asset).
 * Angka = terkirim (sent) dari total Fully Approved; persen = ACK sukses / sent. Bar dibagi dari sent:
 * hijau = ACK sukses, kuning = menunggu ACK, merah = ACK error. Rinciannya ada di tooltip.
 */
export function PatpFusionMini({ legs, total, basis = 'Fully Approved PATP' }: { legs: FusionLeg[]; total: number; basis?: string }) {
  // Kolom nilai (BA Value ACK sukses) hanya muncul bila data punya amount; kartu melebar sedikit agar bar tetap terbaca.
  const hasAmount = legs.some((l) => l.statuses.some((s) => s.amount !== undefined))
  // Grid dengan subgrid: semua baris berbagi kolom yang sama, sehingga label, bar, dan angka selalu sejajar.
  const cols = hasAmount
    ? 'grid-cols-[auto_minmax(14px,1fr)_auto_auto_auto_auto] max-w-[340px]'
    : 'grid-cols-[auto_minmax(14px,1fr)_auto_auto_auto] max-w-[300px]'
  return (
    <div className={`grid ${cols} ml-auto w-full min-w-0 items-center gap-x-1.5 gap-y-1 rounded-md bg-slate-50 px-2 py-1.5 [@media(max-height:700px)]:gap-y-0 [@media(max-height:700px)]:py-1 ring-1 ring-inset ring-slate-200/70`}>
      {legs.map((leg) => {
        const success = countOf(leg.statuses, GR.success)
        const waiting = countOf(leg.statuses, GR.waiting)
        const error = countOf(leg.statuses, GR.error)
        const notSent = countOf(leg.statuses, GR.notSent)
        const sent = total - notSent
        const amountOf = (label: string) => amountOfStatus(leg.statuses, label)
        const seg = (n: number) => (sent ? `${(n / sent) * 100}%` : '0%')
        const detail = [
          `${leg.label} to Oracle Fusion (${leg.interfaceId}), of ${fmt(total)} ${basis}`,
          `Sent: ${fmt(sent)} (${pct(sent, total)} of ${basis})`,
          `ACK rate: ${pct(success, sent)} (ACK Success / Sent)`,
          `ACK Success: ${fmt(success)}`,
          `Waiting ACK: ${fmt(waiting)}`,
          `ACK Error: ${fmt(error)}`,
          `Not sent: ${fmt(notSent)}`,
          ...(hasAmount ? [`BA Value of ACK Success: ${formatIdrFull(amountOf(GR.success))}`] : []),
        ].join('\n')
        return (
          <div
            key={leg.label}
            className="col-span-full grid grid-cols-subgrid items-center text-[11px] font-normal leading-4 text-slate-700 [@media(max-height:700px)]:leading-[14px]"
            title={detail}
            aria-label={detail}
          >
            <span className="flex items-center gap-1 whitespace-nowrap text-left">
              {leg.label}
              {error > 0 && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-rose-600" role="img" aria-label="ACK error present" />}
            </span>
            <div
              className="flex h-2 overflow-hidden rounded-full bg-slate-200"
              role="progressbar"
              aria-label={leg.label}
              aria-valuemin={0}
              aria-valuemax={sent}
              aria-valuenow={success}
            >
              <div className={`h-full ${COLOR.green}`} style={{ width: seg(success) }} />
              <div className={`h-full ${COLOR.yellow}`} style={{ width: seg(waiting) }} />
              <div className={`h-full ${COLOR.red}`} style={{ width: seg(error) }} />
            </div>
            <span className="text-right font-bold tabular-nums text-slate-900">{fmt(sent)}</span>
            <span className={`whitespace-nowrap text-right tabular-nums ${success > 0 ? 'font-semibold text-emerald-700' : 'text-slate-400'}`}>{fmt(success)} ACK</span>
            <span className="text-right tabular-nums text-slate-500">{pct(success, sent)}</span>
            {hasAmount && <span className="whitespace-nowrap text-right tabular-nums text-slate-600">{formatIdr(amountOf(GR.success))}</span>}
          </div>
        )
      })}
    </div>
  )
}
