export type Tone = 'ok' | 'wait' | 'bad' | 'neutral'

/** Satu baris agregat: vendor × status × hari dibuat (`d` = YYYY-MM-DD; null = tanpa tanggal). `x` hanya Baseline (jumlah site). */
export type Row = { v: string; s: string; t: Tone; n: number; d?: string | null; x?: number }

export type ModuleKey =
  | 'baseline'
  | 'mps'
  | 'mpsReserved'
  | 'matc'
  | 'fatp'
  | 'patp'
  | 'cac'
  | 'endorsement'
  | 'caf'
  | 'crRelocation'
  | 'cafAction'

export type SanitationSnapshot = {
  version: 3
  generatedAt: string
  since: string
  durationMs: number
  vendors: { code: string; name: string }[]
  /**
   * Opsional: snapshot yang dibuat sebelum fitur GR/Fusion belum memilikinya.
   * `patpGi`/`patpGr`/`patpFa` = progres Fusion per PATP Fully Approved (INTINV-006, INTINV-005 service, INTPPM-002).
   */
  modules: Record<ModuleKey, Row[]> & { matcGr?: Row[]; patpGi?: Row[]; patpGr?: Row[]; patpFa?: Row[] }
}

export type SanitationApiResponse = {
  snapshot: SanitationSnapshot | null
  stale: boolean
  ageMinutes: number | null
  error?: string
}

/** Snapshot dianggap stale jika lebih tua dari ini (job berjalan per jam). */
export const STALE_AFTER_MINUTES = 150

/** 9 modul yang dihitung pada KEY FACT. */
export const CORE_MODULES: ModuleKey[] = [
  'baseline',
  'mps',
  'matc',
  'fatp',
  'patp',
  'cac',
  'endorsement',
  'caf',
  'crRelocation',
]
