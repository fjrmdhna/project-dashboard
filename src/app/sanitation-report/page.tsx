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
  aggregateCombined,
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

/** Urutan tampilan = alur bisnis. Grid lg 12 kolom: baris 1 = 4 card, baris 2–3 = 3 card. */
const CARDS: CardDef[] = [
  { key: 'mps', title: 'MPS', tone: 'cyan', hint: 'Counted per unique system key. Keys with an MPS transaction use the approval status of the latest transaction; keys without a transaction yet appear as Reserved/Ready. Rp = sum of mapped quantity x latest PO net price (IDR) over all lines of the system key (including Reserved/Ready).' },
  { key: 'baseline', title: 'Baseline', tone: 'navy', hint: 'Counted per unique system key (read from the baseline system key list), using its latest baseline (status of that baseline). Only system keys that already have an MPS transaction are counted; the "of" number is the total MPS system keys including Reserved/Ready.' },
  { key: 'caf', title: 'CAF', tone: 'orange', hint: 'Counted per caf_no, current CAF status.' },
  { key: 'crRelocation', title: 'Change Request', tone: 'red', hint: 'Counted per CR number (type Relocation), latest status; vendor via system key.' },
  { key: 'matc', title: 'MATC / BABT', tone: 'violet', hint: 'Counted per unique system key. Status uses workflow priority across all MATC/BABT BAs for that key (Fully Approved > In Progress > Rejected > No Workflow). Only system keys that have an MPS transaction and at least one material line (not service-only) are counted; the "of" number is all such material-line system keys including Reserved/Ready. Rp beside the count = material-line PO value of those MATC system keys; Rp beside "of" = material-line PO value of the full material-line MPS universe (including Reserved/Ready). Fusion GR Material matches material INTINV-005 files across all Fully Approved MATC BAs for each system key.' },
  { key: 'siteTransfer', title: 'Site Transfer', tone: 'orange', hint: 'Site-to-site transfer to Oracle Fusion (INTINV-007), material only. Counted per unique system key that has at least one transfer line (lines from any MPS transaction of the key; latest interface row per PO line). Status per system key from the latest ACK of each line: any ACK Error = ACK Error; all lines ACK Success = ACK Success; otherwise Waiting ACK. Not Sent = material-line system keys without any transfer line. The "of" number is all MPS system keys with at least one material line, including Reserved/Ready (same as MATC). Rp beside the count = transferred quantity x latest PO net price (IDR); Not Sent Rp = material-line PO value not yet transferred; Rp beside "of" = material-line PO value of the full universe.' },
  { key: 'patp', title: 'Acceptance - PATP', tone: 'violet', hint: 'Counted per unique system key that Master Scope Acceptance requires for PATP. If any PATP for the key was Fully Approved, status stays Fully Approved; otherwise the latest acceptance status is used. The "of" number is MPS system keys (including Reserved/Ready) that require PATP per Master Scope Acceptance. Rp beside the count = Current Realisation on the preferred PATP (Fully Approved when present, else latest; mapped quantity x latest PO net price, IDR, PO-based lines only; WO-only has no value). Rp beside "of" = MPS/PO mapped value (all IDR lines) for every system key in that PATP-required universe when the snapshot includes that amount. Fusion funnel matches all Fully Approved acceptance numbers for each system key.' },
  { key: 'fatp', title: 'Acceptance - FATP', tone: 'cyan', hint: 'Counted per unique system key that Master Scope Acceptance requires for FATP, using its latest FATP acceptance (status of that acceptance). The "of" number is MPS system keys (including Reserved/Ready) that require FATP per Master Scope Acceptance (project type + scope category).' },
  { key: 'endorsement', title: 'Endorsement', tone: 'teal', hint: 'Counted per unique system key, using its latest endorsement (approval status of that system key).' },
  { key: 'cac', title: 'CAC Acceptance / BAUT', tone: 'teal', hint: 'Counted per unique system key. Status uses workflow priority across all CAC/BAUT BAs for that key (Fully Approved > In Progress > Rejected > No Workflow). The "of" number is the total MPS system keys including Reserved/Ready. Rp beside the count = Realisation of ATP Appendix 2 service lines only on the preferred BA for those CAC system keys; Rp beside "of" = service-line PO value for the full MPS universe (including Reserved/Ready). Fusion funnel matches all Fully Approved BAs for each system key.' },
]

const NOT_SENT = 'Not Sent'
const GRID = 'grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-3'
/** Baris 1 (index 0–3): span 3 → 4 card. Baris 2–3: span 4 → 3 card. String utuh untuk Tailwind JIT. */
const cardSpan = (index: number) => (index < 4 ? 'lg:col-span-3' : 'lg:col-span-4')

function formatSince(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function Skeleton() {
  return (
    <div className={GRID} aria-busy="true" aria-label="Loading">
      {CARDS.map((c, i) => (
        <div key={c.key} className={`h-40 animate-pulse rounded-xl border border-slate-200 bg-white ${cardSpan(i)}`} />
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
    ? '· SAP to Fusion & Fusion'
    : selection.preset === 'all'
      ? '· SAP to Fusion & Fusion'
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
          <h1 className="min-w-0 text-sm font-extrabold md:truncate sm:text-base" title={`${scope} Transactions on PMIS ${periodText}`}>
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
            <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2"><div className="min-w-0 rounded-lg border-l-4 border-teal-600 bg-slate-900 px-3 py-1 text-[11px] font-bold text-white sm:text-xs lg:truncate">
              KEY FACT &nbsp;|&nbsp;{' '}
              {active === CORE_MODULES.length
                ? `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in all ${CORE_MODULES.length} modules.`
                : `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in ${active} of ${CORE_MODULES.length} modules.`}
            </div>
            <div className="min-w-0 rounded-lg border-l-4 border-rose-500 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 sm:text-xs lg:truncate">
              CAF ACTION &nbsp;|&nbsp; {fmt(cafWaiting)} waiting submit Pictorial Reports <span className="font-normal">({selection.preset === 'all' ? 'all time' : rangeLabel.toLowerCase()})</span>.
            </div>
            </div>

            <div className={GRID}>
              {CARDS.map((c, i) => {
                const a =
                  c.key === 'mps'
                    ? aggregateCombined([snap.modules.mps, snap.modules.mpsReserved], vendorSet, range)
                    : aggregate(snap.modules[c.key] ?? [], vendorSet, range)
                // Site Transfer: X = system key yang sudah punya line transfer (tanpa Not Sent); bar tetap dari seluruh universe.
                const notSent = c.key === 'siteTransfer' ? a.statuses.find((s) => s.label === NOT_SENT) : undefined
                const xCount = a.created - (notSent?.count ?? 0)
                const xAmount = a.amount !== undefined ? a.amount - (notSent?.amount ?? 0) : undefined
                let note: React.ReactNode
                if (c.key === 'matc' && snap.modules.matcGr) {
                  // Tetap tampil (0) saat filter menghasilkan 0 system key Fully Approved; hanya disembunyikan jika snapshot lama tanpa matcGr.
                  const gr = aggregate(snap.modules.matcGr, vendorSet, range)
                  note = <PatpFusionMini total={gr.created} basis="Fully Approved system key" legs={[{ label: 'GR Material', interfaceId: 'INTINV-005', statuses: gr.statuses }]} />
                }
                if (c.key === 'cac' && snap.modules.cacGr && snap.modules.cacFa) {
                  // Basis = Fully Approved system key (prioritas workflow); tampil 0 saat filter kosong.
                  const grs = aggregate(snap.modules.cacGr, vendorSet, range)
                  const fa = aggregate(snap.modules.cacFa, vendorSet, range)
                  note = (
                    <PatpFusionMini
                      total={grs.created}
                      basis="Fully Approved system key"
                      legs={[
                        { label: 'GR Service', interfaceId: 'INTINV-005', statuses: grs.statuses },
                        { label: 'Fixed Asset', interfaceId: 'INTPPM-002', statuses: fa.statuses },
                      ]}
                    />
                  )
                }
                if (c.key === 'patp' && snap.modules.patpGi && snap.modules.patpGr && snap.modules.patpFa) {
                  // Basis = Fully Approved system key (pernah FA); tampil 0 saat filter kosong; hilang hanya snapshot lama.
                  const gi = aggregate(snap.modules.patpGi, vendorSet, range)
                  const grs = aggregate(snap.modules.patpGr, vendorSet, range)
                  const fa = aggregate(snap.modules.patpFa, vendorSet, range)
                  note = (
                    <PatpFusionMini
                      total={gi.created}
                      basis="Fully Approved system key"
                      legs={[
                        { label: 'GI Material', interfaceId: 'INTINV-006', statuses: gi.statuses },
                        { label: 'GR Service', interfaceId: 'INTINV-005', statuses: grs.statuses },
                        { label: 'Fixed Asset', interfaceId: 'INTPPM-002', statuses: fa.statuses },
                      ]}
                    />
                  )
                }
                const ofLabel = (y: { created: number; amount?: number }) =>
                  y.amount !== undefined
                    ? `of ${fmt(y.created)} · ${formatIdr(y.amount)}`
                    : `of ${fmt(y.created)} system key`
                const xyAmount = c.key === 'matc' || c.key === 'patp' || c.key === 'cac' || c.key === 'siteTransfer'
                return (
                  <ModuleCard
                    key={c.key}
                    className={cardSpan(i)}
                    title={c.title}
                    tone={c.tone}
                    unit={c.unit}
                    hint={c.hint}
                    value={xCount}
                    amountLabel={xyAmount && xAmount !== undefined ? formatIdr(xAmount) : undefined}
                    subValue={
                      c.key === 'baseline'
                        ? `of ${fmt(aggregateCombined([snap.modules.mps, snap.modules.mpsReserved], vendorSet, range).created)} system key`
                        : (c.key === 'matc' || c.key === 'siteTransfer') && snap.modules.mpsMaterial
                          ? ofLabel(aggregate(snap.modules.mpsMaterial, vendorSet, range))
                          : c.key === 'fatp' && snap.modules.fatpScope
                            ? `of ${fmt(aggregate(snap.modules.fatpScope, vendorSet, range).created)} system key`
                            : c.key === 'patp' && snap.modules.patpScope
                              ? ofLabel(aggregate(snap.modules.patpScope, vendorSet, range))
                              : c.key === 'cac'
                                ? ofLabel({
                                    created: aggregateCombined([snap.modules.mps, snap.modules.mpsReserved], vendorSet, range).created,
                                    amount: snap.modules.mpsService
                                      ? aggregate(snap.modules.mpsService, vendorSet, range).amount
                                      : undefined,
                                  })
                                : a.amount !== undefined ? formatIdr(a.amount) : undefined
                    }
                    note={note}
                    divided={c.key === 'matc' || c.key === 'patp' || c.key === 'cac'}
                    stackSub={c.key === 'cac' || c.key === 'patp' || c.key === 'matc' || c.key === 'fatp' || c.key === 'siteTransfer'}
                    dimmed={a.created === 0}
                  >
                    <StatusBreakdown statuses={a.statuses} total={a.created} title={c.title} tall={c.key === 'patp' || c.key === 'cac' ? 'compact' : false} />
                  </ModuleCard>
                )
              })}
            </div>


            <footer className="flex shrink-0 items-center justify-between text-[10px] text-slate-500">
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
    <>
      <div inert>
        <Suspense fallback={null}>
          <Report />
        </Suspense>
      </div>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="sanitation-maintenance-title"
        aria-describedby="sanitation-maintenance-description"
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-4 backdrop-blur-md"
      >
        <div className="w-full max-w-md rounded-2xl bg-white px-8 py-10 text-center shadow-2xl">
          <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-teal-700">Sanitation Report</p>
          <h1 id="sanitation-maintenance-title" className="text-3xl font-bold text-slate-900">Under Maintenance</h1>
          <p id="sanitation-maintenance-description" className="mt-4 text-sm leading-6 text-slate-600">
            Halaman ini sedang dalam pemeliharaan. Silakan kembali lagi nanti.
          </p>
        </div>
      </div>
    </>
  )
}
