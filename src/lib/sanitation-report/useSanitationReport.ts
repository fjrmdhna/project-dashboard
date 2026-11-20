'use client'

import { useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import type { DateSelection } from '@/components/sanitation/DateFilter'
import {
  PRESET_LABEL,
  isISODate,
  isPreset,
  presetRange,
  toISODate,
  vendorLabel,
  type DateRange,
} from '@/lib/sanitation-report/aggregate'
import type { SanitationApiResponse } from '@/lib/sanitation-report/types'

const fetcher = async (url: string): Promise<SanitationApiResponse> => {
  const res = await fetch(url, { cache: 'no-store' })
  return res.json()
}

function formatSince(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

/** Shared filters, snapshot fetch, and refresh for Sanitation Report pages. */
export function useSanitationReport() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { data, isLoading, mutate } = useSWR('/api/sanitation-report', fetcher, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)

  const refresh = async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      const before = data?.snapshot?.generatedAt
      const next = await fetcher('/api/sanitation-report?fresh=1')
      if (!next.snapshot) throw new Error(next.error ?? 'Snapshot tidak tersedia')
      await mutate(next, { revalidate: false })
      setRefreshMsg(
        next.snapshot.generatedAt === before
          ? 'Already the latest snapshot (rebuilt hourly).'
          : 'New snapshot loaded.',
      )
    } catch (e) {
      setRefreshMsg(`Refresh failed: ${e instanceof Error ? e.message : 'unknown error'}`)
    } finally {
      setRefreshing(false)
      setTimeout(() => setRefreshMsg(null), 4000)
    }
  }

  const snap = data?.snapshot
  const selected = useMemo(() => (params.get('vendor') ?? '').split(',').filter(Boolean), [params])
  const vendorSet = useMemo(() => new Set(selected), [selected])
  const options = useMemo(
    () => (snap ? [...snap.vendors].sort((a, b) => a.name.localeCompare(b.name)) : []),
    [snap],
  )

  const setSelected = (codes: string[]) => {
    const sp = new URLSearchParams(params.toString())
    if (codes.length) sp.set('vendor', codes.join(','))
    else sp.delete('vendor')
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const rangeParam = params.get('range')
  const fromParam = params.get('from')
  const toParam = params.get('to')
  const today = toISODate(new Date())
  const selection: DateSelection = useMemo(() => {
    if (isPreset(rangeParam)) return { preset: rangeParam, from: '', to: '' }
    if (isISODate(fromParam) || isISODate(toParam)) {
      return { preset: null, from: isISODate(fromParam) ? fromParam : '', to: isISODate(toParam) ? toParam : '' }
    }
    return { preset: 'all', from: '', to: '' }
  }, [rangeParam, fromParam, toParam])
  const range: DateRange = useMemo(
    () =>
      selection.preset
        ? presetRange(selection.preset)
        : { from: selection.from || undefined, to: selection.to || undefined },
    [selection],
  )

  const setSelection = (v: DateSelection) => {
    const sp = new URLSearchParams(params.toString())
    sp.delete('range')
    sp.delete('from')
    sp.delete('to')
    if (v.preset && v.preset !== 'all') sp.set('range', v.preset)
    else if (!v.preset) {
      if (v.from) sp.set('from', v.from)
      if (v.to) sp.set('to', v.to)
    }
    const qs = sp.toString()
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const fmtDay = (iso: string) =>
    new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
  const rangeLabel = selection.preset
    ? PRESET_LABEL[selection.preset]
    : `${selection.from ? fmtDay(selection.from) : '…'} – ${selection.to ? fmtDay(selection.to) : '…'}`
  const periodText = !snap
    ? '· SAP to Fusion & Fusion'
    : selection.preset === 'all'
      ? '· SAP to Fusion & Fusion'
      : range.from && range.from === range.to
        ? `on ${fmtDay(range.from)}`
        : `from ${range.from ? fmtDay(range.from) : formatSince(snap.since)} to ${range.to ? fmtDay(range.to) : 'today'}`

  const scope =
    selected.length === 0 ? 'All Vendor' : selected.length === 1 && snap ? vendorLabel(snap, selected[0]) : `${selected.length} Vendors`

  return {
    data,
    isLoading,
    snap,
    selected,
    vendorSet,
    options,
    setSelected,
    selection,
    setSelection,
    range,
    rangeLabel,
    periodText,
    scope,
    today,
    refreshing,
    refreshMsg,
    refresh,
  }
}
