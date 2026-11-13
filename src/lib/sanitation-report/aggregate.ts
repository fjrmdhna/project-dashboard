import { CORE_MODULES, type ModuleKey, type Row, type SanitationSnapshot, type Tone } from './types'

export type StatusItem = { label: string; tone: Tone; count: number; amount?: number }
export type Aggregated = { created: number; extra: number; statuses: StatusItem[]; amount?: number }

/** Rentang tanggal inklusif (YYYY-MM-DD). Kosong = tanpa batas. */
export type DateRange = { from?: string; to?: string }

function inRange(d: string | null | undefined, r: DateRange): boolean {
  if (!d) return true // baris tanpa tanggal (mis. CAF ACTION all-time) tidak difilter
  if (r.from && d < r.from) return false
  if (r.to && d > r.to) return false
  return true
}

/** vendors kosong = semua vendor. */
export function aggregate(rows: Row[], vendors: ReadonlySet<string>, range: DateRange = {}): Aggregated {
  const map = new Map<string, StatusItem>()
  let created = 0
  let extra = 0
  let amount: number | undefined
  for (const r of rows) {
    if (vendors.size > 0 && !vendors.has(r.v)) continue
    if (!inRange(r.d, range)) continue
    created += r.n
    extra += r.x ?? 0
    const cur = map.get(r.s) ?? { label: r.s, tone: r.t, count: 0 }
    cur.count += r.n
    if (r.a !== undefined) {
      cur.amount = (cur.amount ?? 0) + r.a
      amount = (amount ?? 0) + r.a
    }
    map.set(r.s, cur)
  }
  const statuses = [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return { created, extra, statuses, amount }
}

export function sumCount(rows: Row[], vendors: ReadonlySet<string>, range: DateRange = {}): number {
  return aggregate(rows, vendors, range).created
}

/** Jumlah modul (dari 9) yang punya transaksi untuk vendor & tanggal terpilih. */
export function modulesWithTransactions(
  snap: SanitationSnapshot,
  vendors: ReadonlySet<string>,
  range: DateRange = {},
): number {
  return CORE_MODULES.filter((k: ModuleKey) => sumCount(snap.modules[k], vendors, range) > 0).length
}

export function vendorLabel(snap: SanitationSnapshot, code: string): string {
  if (code === 'UNKNOWN') return 'Unknown vendor'
  return snap.vendors.find((v) => v.code === code)?.name || code
}

export function pct(count: number, total: number): string {
  if (!total) return '0%'
  const p = (count / total) * 100
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

// ---------- Nilai IDR ----------
/** Format ringkas (English): Rp 37.65 B / Rp 850.00 M / Rp 12.00 K. B = billion, M = million, K = thousand. */
export function formatIdr(n: number): string {
  const abs = Math.abs(n)
  const trim = (v: number) => v.toFixed(2)
  if (abs >= 1e12) return `Rp ${(n / 1e12).toFixed(2)} T`
  if (abs >= 1e9) return `Rp ${trim(n / 1e9)} B`
  if (abs >= 1e6) return `Rp ${trim(n / 1e6)} M`
  if (abs >= 1e3) return `Rp ${trim(n / 1e3)} K`
  return `Rp ${Math.round(n)}`
}

/** Nilai penuh untuk tooltip, mis. Rp 37,650,251,826. */
export const formatIdrFull = (n: number) => `Rp ${Math.round(n).toLocaleString('en-US')}`

// ---------- Tanggal ----------
export type RangePreset = 'all' | 'today' | 'yesterday' | '7d' | '30d'

export const PRESET_LABEL: Record<RangePreset, string> = {
  all: 'All dates',
  today: 'Today',
  yesterday: 'Yesterday',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
}

const pad = (n: number) => String(n).padStart(2, '0')
export const toISODate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function presetRange(p: RangePreset, now = new Date()): DateRange {
  const day = (offset: number) => {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset)
    return toISODate(d)
  }
  switch (p) {
    case 'today':
      return { from: day(0), to: day(0) }
    case 'yesterday':
      return { from: day(-1), to: day(-1) }
    case '7d':
      return { from: day(-6), to: day(0) }
    case '30d':
      return { from: day(-29), to: day(0) }
    default:
      return {}
  }
}

export function isPreset(v: string | null): v is RangePreset {
  return v === 'all' || v === 'today' || v === 'yesterday' || v === '7d' || v === '30d'
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/
export const isISODate = (v: string | null): v is string => !!v && ISO_RE.test(v)
