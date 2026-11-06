import type { Tone } from '@/lib/sanitation-report/types'

/**
 * Palet semantik tunggal untuk seluruh bar dan titik status di halaman sanitation:
 * hijau = selesai/sukses, kuning = berjalan/menunggu, merah = ditolak/error.
 * Status `neutral` (tidak terklasifikasi) dianggap belum selesai, jadi memakai kuning.
 */
export const COLOR = {
  green: 'bg-emerald-600',
  yellow: 'bg-amber-400',
  red: 'bg-rose-600',
} as const

export const TONE_BG: Record<Tone, string> = {
  ok: COLOR.green,
  wait: COLOR.yellow,
  bad: COLOR.red,
  neutral: COLOR.yellow,
}

/** Urutan segmen bar: hijau, kuning, merah. */
export const BAR_ORDER = ['green', 'yellow', 'red'] as const

export const TONE_GROUP: Record<Tone, (typeof BAR_ORDER)[number]> = {
  ok: 'green',
  wait: 'yellow',
  bad: 'red',
  neutral: 'yellow',
}

