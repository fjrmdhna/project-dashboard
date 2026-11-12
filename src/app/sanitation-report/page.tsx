'use client'

import { Suspense, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { DateFilter, type DateSelection } from '@/components/sanitation/DateFilter'
import { PatpFusionMini } from '@/components/sanitation/GrPipeline'
import { ModuleCard, fmt, type ModuleCardTone } from '@/components/sanitation/ModuleCard'
import { StatusBreakdown } from '@/components/sanitation/StatusBreakdown'
import { VendorFilter } from '@/components/sanitation/VendorFilter'
import {
  PRESET_LABEL,
  aggregate,
  isISODate,
  formatIdr,
  isPreset,
  modulesWithTransactions,
  presetRange,
  sumCount,
  toISODate,
  vendorLabel,
  type DateRange,
} from '@/lib/sanitation-report/aggregate'
import { CORE_MODULES, type ModuleKey, type SanitationApiResponse } from '@/lib/sanitation-report/types'

const fetcher = async (url: string): Promise<SanitationApiResponse> => {
  const res = await fetch(url, { cache: 'no-store' })
  return res.json()
}

type CardDef = {
  key: ModuleKey
  title: string
  tone: ModuleCardTone
  unit?: string
  hint: string
}

const CARDS: CardDef[] = [
  { key: 'mps', title: 'MPS', tone: 'cyan', hint: 'Counted per MPS transaction (mps_transaction_id), latest approval status.' },
  { key: 'baseline', title: 'Baseline', tone: 'navy', unit: 'Project', hint: 'Counted per baseline_id (project). Sites = sum of total_system_key.' },
  { key: 'matc', title: 'MATC / BABT', tone: 'violet', hint: 'Counted per BA number; vendor derived from system key → PO mapping.' },
  { key: 'caf', title: 'CAF', tone: 'orange', hint: 'Counted per caf_no, current CAF status.' },
  { key: 'crRelocation', title: 'Change Request', tone: 'red', hint: 'Counted per CR number (type Relocation), latest status; vendor via system key.' },
  { key: 'fatp', title: 'Acceptance - FATP', tone: 'cyan', hint: 'Counted per acceptance_number (FATP), latest status.' },
  { key: 'patp', title: 'Acceptance - PATP', tone: 'violet', hint: 'Counted per acceptance_number (PATP), latest status. Rp = derived BA Value (mapped quantity x PO net price, IDR, PO-based lines only); PMIS has no BA Value for PATP, and WO-only PATP (no PO) has no value.' },
  { key: 'endorsement', title: 'Endorsement', tone: 'teal', hint: 'Counted per endorse_number. Fully Approved = all systems endorsed.' },
  { key: 'cac', title: 'CAC Acceptance / BAUT', tone: 'teal', hint: 'Counted per BA number, latest workflow status.' },
]

function formatSince(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Skeleton() {
  return (
    <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
      ))}
    </div>
  )
}

function Report() {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()
  const { data, isLoading, mutate } = useSWR('/api/sanitation-report', fetcher, {
    refreshInterval: 5 * 60 * 1000,
    revalidateOnFocus: false,
  })
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState<string | null>(null)
  const isValidating = refreshing

  /** Muat ulang snapshot terbaru (lewati cache server) dan beri umpan balik ke pengguna. */
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

  // ---- Filter tanggal (URL: ?range=today|yesterday|7d|30d|all  atau  ?from=YYYY-MM-DD&to=YYYY-MM-DD) ----
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
    ? 'since 20 Oct 2026'
    : selection.preset === 'all'
      ? `since ${formatSince(snap.since)}`
      : range.from && range.from === range.to
        ? `on ${fmtDay(range.from)}`
        : `from ${range.from ? fmtDay(range.from) : formatSince(snap.since)} to ${range.to ? fmtDay(range.to) : 'today'}`

  const scope =
    selected.length === 0 ? 'All Vendor' : selected.length === 1 && snap ? vendorLabel(snap, selected[0]) : `${selected.length} Vendors`
  const cafWaiting = snap ? sumCount(snap.modules.cafAction, vendorSet, range) : 0
  const active = snap ? modulesWithTransactions(snap, vendorSet, range) : 0

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 lg:h-dvh lg:overflow-hidden">
      <header className="z-20 shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2 md:flex-nowrap">
          <h1 className="min-w-0 text-base font-extrabold md:truncate sm:text-lg" title={`${scope} Transactions on PMIS ${periodText}`}>
            {scope} Transactions on PMIS {periodText}
          </h1>
          <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-nowrap">
            {snap && <VendorFilter options={options} selected={selected} onChange={setSelected} />}
            {snap && (
              <DateFilter value={selection} min={snap.since} max={today} label={rangeLabel} onChange={setSelection} />
            )}
            {snap && (
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  data?.stale ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {data?.stale ? `Stale · ${data.ageMinutes} min ago` : `Updated ${new Date(snap.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
              </span>
            )}
            <span role="status" aria-live="polite" className="text-xs font-semibold text-slate-600">
              {refreshMsg}
            </span>
            <button
              type="button"
              onClick={refresh}
              aria-label="Refresh data"
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
            >
              {isValidating ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-2 px-4 py-2">
        {isLoading && <Skeleton />}

        {!isLoading && !snap && (
          <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
            Snapshot belum tersedia{data?.error ? ` (${data.error})` : ''}. Jalankan <code>node scripts/sanitation-snapshot.mjs</code> atau
            tunggu job per jam.
          </div>
        )}

        {snap && (
          <>
            <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2"><div className="min-w-0 rounded-lg border-l-4 border-teal-600 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white sm:text-sm lg:truncate">
              KEY FACT &nbsp;|&nbsp;{' '}
              {active === CORE_MODULES.length
                ? `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in all ${CORE_MODULES.length} modules.`
                : `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in ${active} of ${CORE_MODULES.length} modules.`}
            </div>
            <div className="min-w-0 rounded-lg border-l-4 border-rose-500 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 sm:text-sm lg:truncate">
              CAF ACTION &nbsp;|&nbsp; {fmt(cafWaiting)} waiting submit Pictorial Reports <span className="font-normal">({selection.preset === 'all' ? 'all time' : rangeLabel.toLowerCase()})</span>.
            </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
              {CARDS.map((c) => {
                const a = aggregate(snap.modules[c.key], vendorSet, range)
                let note: React.ReactNode
                if (c.key === 'mps') {
                  note = `${fmt(sumCount(snap.modules.mpsReserved, vendorSet, range))} Reserved/Ready MPS IDs`
                }
                if (c.key === 'matc' && snap.modules.matcGr) {
                  // Tetap tampil (0) saat filter menghasilkan 0 BA Fully Approved; hanya disembunyikan jika snapshot lama tanpa matcGr.
                  const gr = aggregate(snap.modules.matcGr, vendorSet, range)
                  note = <PatpFusionMini total={gr.created} basis="Fully Approved BA" legs={[{ label: 'GR Material', interfaceId: 'INTINV-005', statuses: gr.statuses }]} />
                }
                if (c.key === 'cac' && snap.modules.cacGr && snap.modules.cacFa) {
                  // Basis = BA CAC Fully Approved; tampil 0 saat filter tidak menyisakan BA, hilang hanya untuk snapshot lama.
                  const grs = aggregate(snap.modules.cacGr, vendorSet, range)
                  const fa = aggregate(snap.modules.cacFa, vendorSet, range)
                  note = (
                    <PatpFusionMini
                      total={grs.created}
                      basis="Fully Approved BA"
                      legs={[
                        { label: 'GR Service', interfaceId: 'INTINV-005', statuses: grs.statuses },
                        { label: 'Fixed Asset', interfaceId: 'INTPPM-002', statuses: fa.statuses },
                      ]}
                    />
                  )
                }
                if (c.key === 'patp' && snap.modules.patpGi && snap.modules.patpGr && snap.modules.patpFa) {
                  // Basis = PATP Fully Approved; tampil 0 saat filter tidak menyisakan PATP, hilang hanya untuk snapshot lama.
                  const gi = aggregate(snap.modules.patpGi, vendorSet, range)
                  const grs = aggregate(snap.modules.patpGr, vendorSet, range)
                  const fa = aggregate(snap.modules.patpFa, vendorSet, range)
                  note = (
                    <PatpFusionMini
                      total={gi.created}
                      legs={[
                        { label: 'GI Material', interfaceId: 'INTINV-006', statuses: gi.statuses },
                        { label: 'GR Service', interfaceId: 'INTINV-005', statuses: grs.statuses },
                        { label: 'Fixed Asset', interfaceId: 'INTPPM-002', statuses: fa.statuses },
                      ]}
                    />
                  )
                }
                return (
                  <ModuleCard
                    key={c.key}
                    title={c.title}
                    tone={c.tone}
                    unit={c.unit}
                    hint={c.hint}
                    value={a.created}
                    subValue={c.key === 'baseline' ? `${fmt(a.extra)} Site` : a.amount !== undefined ? formatIdr(a.amount) : undefined}
                    note={note}
                    divided={c.key === 'matc' || c.key === 'patp' || c.key === 'cac'}
                    stackSub={c.key === 'cac' || c.key === 'patp'}
                    dimmed={a.created === 0}
                  >
                    <StatusBreakdown statuses={a.statuses} total={a.created} title={c.title} tall={c.key === 'patp' ? true : c.key === 'cac' ? 'compact' : false} />
                  </ModuleCard>
                )
              })}
            </div>


            <footer className="flex shrink-0 items-center justify-between text-[11px] text-slate-500">
              <span>
                Snapshot {new Date(snap.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              </span>
            </footer>
          </>
        )}
      </main>
    </div>
  )
}

export default function SanitationReportPage() {
  return (
    <Suspense fallback={null}>
      <Report />
    </Suspense>
  )
}
