export type Tone = 'ok' | 'wait' | 'bad' | 'neutral'

/** Satu baris agregat: vendor × status. `x` hanya dipakai Baseline (jumlah site). */
export type Row = { v: string; s: string; t: Tone; n: number; x?: number }

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
  version: 2
  generatedAt: string
  since: string
  durationMs: number
  vendors: { code: string; name: string }[]
  modules: Record<ModuleKey, Row[]>
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
