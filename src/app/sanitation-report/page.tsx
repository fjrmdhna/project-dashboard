'use client'

import { Suspense, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import useSWR from 'swr'
import { ModuleCard, fmt, type ModuleCardTone } from '@/components/sanitation/ModuleCard'
import { StatusBreakdown } from '@/components/sanitation/StatusBreakdown'
import { VendorFilter } from '@/components/sanitation/VendorFilter'
import { aggregate, modulesWithTransactions, sumCount, vendorLabel } from '@/lib/sanitation-report/aggregate'
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
  { key: 'baseline', title: 'Baseline', tone: 'navy', unit: 'Project', hint: 'Counted per baseline_id (project). Sites = sum of total_system_key.' },
  { key: 'mps', title: 'MPS', tone: 'cyan', hint: 'Counted per MPS transaction (mps_transaction_id), latest approval status.' },
  { key: 'matc', title: 'MATC / BABT', tone: 'violet', hint: 'Counted per BA number; vendor derived from system key → PO mapping.' },
  { key: 'fatp', title: 'Acceptance - FATP', tone: 'cyan', hint: 'Counted per acceptance_number (FATP), latest status.' },
  { key: 'patp', title: 'Acceptance - PATP', tone: 'violet', hint: 'Counted per acceptance_number (PATP), latest status.' },
  { key: 'cac', title: 'CAC / BAUT', tone: 'teal', hint: 'Counted per BA number, latest workflow status.' },
  { key: 'endorsement', title: 'Endorsement', tone: 'teal', hint: 'Counted per endorse_number. Fully Approved = all systems endorsed.' },
  { key: 'caf', title: 'CAF', tone: 'orange', hint: 'Counted per caf_no, current CAF status.' },
  { key: 'crRelocation', title: 'CR - Relocation', tone: 'red', hint: 'Counted per CR number (Relocation), latest status; vendor via system key.' },
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

  const scope =
    selected.length === 0 ? 'All Vendor' : selected.length === 1 && snap ? vendorLabel(snap, selected[0]) : `${selected.length} Vendors`
  const cafWaiting = snap ? sumCount(snap.modules.cafAction, vendorSet) : 0
  const active = snap ? modulesWithTransactions(snap, vendorSet) : 0

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 lg:h-dvh lg:overflow-hidden">
      <header className="z-20 shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center justify-between gap-2 px-4 py-2">
          <h1 className="text-base font-extrabold sm:text-lg">
            {scope} Transactions on PMIS since {snap ? formatSince(snap.since) : '20 Oct 2026'}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {snap && <VendorFilter options={options} selected={selected} onChange={setSelected} />}
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
            <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2"><div className="rounded-lg border-l-4 border-teal-600 bg-slate-900 px-3 py-1.5 text-xs font-bold text-white sm:text-sm">
              KEY FACT &nbsp;|&nbsp;{' '}
              {active === CORE_MODULES.length
                ? `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in all ${CORE_MODULES.length} modules.`
                : `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in ${active} of ${CORE_MODULES.length} modules.`}
            </div>
            <div className="rounded-lg border-l-4 border-rose-500 bg-rose-50 px-3 py-1.5 text-xs font-bold text-rose-700 sm:text-sm">
              CAF ACTION &nbsp;|&nbsp; {fmt(cafWaiting)} waiting submit Pictorial Reports.
            </div>
            </div>

            <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-3">
              {CARDS.map((c) => {
                const a = aggregate(snap.modules[c.key], vendorSet)
                let note: React.ReactNode
                if (c.key === 'mps') {
                  note = `${fmt(sumCount(snap.modules.mpsReserved, vendorSet))} Reserved/Ready MPS IDs`
                }
                return (
                  <ModuleCard
                    key={c.key}
                    title={c.title}
                    tone={c.tone}
                    unit={c.unit}
                    hint={c.hint}
                    value={a.created}
                    subValue={c.key === 'baseline' ? `${fmt(a.extra)} Site` : undefined}
                    note={note}
                    dimmed={a.created === 0}
                  >
                    <StatusBreakdown statuses={a.statuses} total={a.created} title={c.title} />
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
