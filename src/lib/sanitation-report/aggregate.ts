import { CORE_MODULES, type ModuleKey, type Row, type SanitationSnapshot, type Tone } from './types'

export type StatusItem = { label: string; tone: Tone; count: number }
export type Aggregated = { created: number; extra: number; statuses: StatusItem[] }

/** vendors kosong = semua vendor. */
export function aggregate(rows: Row[], vendors: ReadonlySet<string>): Aggregated {
  const map = new Map<string, StatusItem>()
  let created = 0
  let extra = 0
  for (const r of rows) {
    if (vendors.size > 0 && !vendors.has(r.v)) continue
    created += r.n
    extra += r.x ?? 0
    const cur = map.get(r.s) ?? { label: r.s, tone: r.t, count: 0 }
    cur.count += r.n
    map.set(r.s, cur)
  }
  const statuses = [...map.values()].sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
  return { created, extra, statuses }
}

export function sumCount(rows: Row[], vendors: ReadonlySet<string>): number {
  return aggregate(rows, vendors).created
}

/** Jumlah modul (dari 9) yang punya transaksi untuk vendor terpilih. */
export function modulesWithTransactions(snap: SanitationSnapshot, vendors: ReadonlySet<string>): number {
  return CORE_MODULES.filter((k: ModuleKey) => sumCount(snap.modules[k], vendors) > 0).length
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

