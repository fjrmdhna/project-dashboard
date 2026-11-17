export type Tone = 'ok' | 'wait' | 'bad' | 'neutral'

/** Satu baris agregat: vendor × status × hari dibuat (`d` = YYYY-MM-DD; null = tanpa tanggal). `x` hanya Baseline (jumlah site). `a` = nilai IDR (opsional, saat ini hanya MATC). */
export type Row = { v: string; s: string; t: Tone; n: number; d?: string | null; x?: number; a?: number }

export type ModuleKey =
  | 'baseline'
  | 'mps'
  | 'mpsReserved'
  | 'matc'
  | 'siteTransfer'
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
   * `patpGi`/`patpGr`/`patpFa` = progres Fusion per Fully Approved system key.
   * `fatpScope`/`patpScope` = penyebut "of Y" (MPS universe ∩ master_scope_acceptance).
   */
  modules: Record<ModuleKey, Row[]> & {
    mpsMaterial?: Row[]
    /** Populasi MPS+Reserved dengan a = service lines only (Rp of-Y CAC). */
    mpsService?: Row[]
    matcGr?: Row[]
    patpGi?: Row[]
    patpGr?: Row[]
    patpFa?: Row[]
    cacGr?: Row[]
    cacFa?: Row[]
    fatpScope?: Row[]
    patpScope?: Row[]
  }
}

export type SanitationApiResponse = {
  snapshot: SanitationSnapshot | null
  stale: boolean
  ageMinutes: number | null
  error?: string
}

/** Snapshot dianggap stale jika lebih tua dari ini (job berjalan per jam). */
export const STALE_AFTER_MINUTES = 150

/** Modul yang dihitung pada KEY FACT (urutan = tampilan card). */
export const CORE_MODULES: ModuleKey[] = [
  'mps',
  'baseline',
  'caf',
  'crRelocation',
  'matc',
  'siteTransfer',
  'patp',
  'fatp',
  'endorsement',
  'cac',
]
