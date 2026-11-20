'use client'

import { Suspense } from 'react'
import { ModuleCard, fmt, type ModuleCardTone } from '@/components/sanitation/ModuleCard'
import { SanitationShell } from '@/components/sanitation/SanitationShell'
import { StatusBreakdown } from '@/components/sanitation/StatusBreakdown'
import { aggregate, aggregateCombined, formatIdr } from '@/lib/sanitation-report/aggregate'
import { MPS_CARD_HINT } from '@/lib/sanitation-report/hints'
import type { ModuleKey, Row, SanitationSnapshot } from '@/lib/sanitation-report/types'
import { useSanitationReport } from '@/lib/sanitation-report/useSanitationReport'

type CardDef = {
  /** Snapshot module key, or optional funnel key stored outside ModuleKey. */
  key: ModuleKey | 'matcGr' | 'patpGi' | 'patpGr' | 'patpFa'
  title: string
  tone: ModuleCardTone
  hint: string
  /** Keep "not sent yet" statuses out of the big number; they stay in the "of" total. */
  excludeNotSent?: boolean
  /** of-Y = MPS Fully Approved count from Page 1 module `mps` (same source). */
  ofFromPage1MpsFullyApproved?: boolean
}

const NETGEAR_CARDS: CardDef[] = [
  {
    key: 'netgearMpsApproved',
    title: 'MPS Approved',
    tone: 'cyan',
    excludeNotSent: true,
    /** of-Y locked to Page 1 MPS Fully Approved (same module rows). */
    ofFromPage1MpsFullyApproved: true,
    hint: 'PMIS → Netgear outbound. The "of" number is MPS Fully Approved from Page 1 (same source). Big number = those keys already exported to Netgear. Status from the latest non-superseded export lines: ACK Success / Waiting ACK / ACK Error. Not Sent = Fully Approved on Page 1 but not yet exported.',
  },
  {
    key: 'netgearMpsApprovedAck',
    title: 'MPS Approved ACK',
    tone: 'teal',
    hint: 'Netgear → PMIS inbound ACK (mps_approved_ack). Counted per unique system key in the MPS universe, using its latest received ACK. Status from payload: ACK Success / ACK Error / Waiting ACK when status is missing.',
  },
  {
    key: 'netgearTaggingMos',
    title: 'Tagging MOS',
    tone: 'violet',
    hint: 'Netgear task tagging (MOS). Counted per unique system key. Status: if any task is not finished, its latest status (Waiting*/Need*) is shown; otherwise Fully Approved; Cancelled only if all tasks are cancelled.',
  },
  {
    key: 'netgearTaggingGreen',
    title: 'Tagging GREEN',
    tone: 'orange',
    hint: 'Netgear task tagging (GREEN). GREEN tasks carry PO + line only, so they are mapped to system keys through the PO line mapping. Counted per unique system key. Status: if any task is not finished, its latest status (Waiting*/Need*) is shown; otherwise Fully Approved; Cancelled only if all tasks are cancelled.',
  },
]

const FUSION_CARDS: CardDef[] = [
  {
    // Identical to the MPS card on Page 1 (same modules, same aggregation, same hint).
    key: 'mps',
    title: 'MPS',
    tone: 'cyan',
    hint: MPS_CARD_HINT,
  },
  {
    key: 'siteTransfer',
    title: 'Site Transfer',
    tone: 'orange',
    excludeNotSent: true,
    hint: 'Oracle Fusion INTINV-007 (material). Same universe and status rules as Page 1 Site Transfer: ACK Success / Waiting ACK / ACK Error / Not Sent per material-line system key.',
  },
  {
    key: 'matcGr',
    title: 'GR Material',
    tone: 'violet',
    excludeNotSent: true,
    hint: 'Oracle Fusion INTINV-005 material files for Fully Approved MATC/BABT system keys. Status: Not Sent / Waiting ACK / ACK Success / ACK Error.',
  },
  {
    key: 'patpGi',
    title: 'GI Material',
    tone: 'cyan',
    excludeNotSent: true,
    hint: 'Oracle Fusion INTINV-006 for Fully Approved PATP system keys. Status: Not Sent / Waiting ACK / ACK Success / ACK Error.',
  },
  {
    key: 'patpGr',
    title: 'GR Service',
    tone: 'teal',
    excludeNotSent: true,
    hint: 'Oracle Fusion INTINV-005 service files for Fully Approved PATP system keys. Status: Not Sent / Waiting ACK / ACK Success / ACK Error.',
  },
  {
    key: 'patpFa',
    title: 'Fixed Asset',
    tone: 'navy',
    excludeNotSent: true,
    hint: 'Oracle Fusion INTPPM-002 for Fully Approved PATP system keys. Status: Not Sent / Waiting ACK / ACK Success / ACK Error.',
  },
]

const NOT_SENT_LABELS = new Set(['Not Sent'])
const MPS_FA = 'MPS Fully Approved'
const NETGEAR_MPS_STATUSES = new Set(['ACK Success', 'Waiting ACK', 'ACK Error', 'Not Sent'])
/**
 * One-screen layout (laptop 1920x1080 @150% => ~1245x590 viewport in Firefox):
 * lg+  : Netgear 4 across + Fusion 5 across, each section shares the remaining height.
 * <lg  : stacked cards, page scrolls.
 */
const NETGEAR_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-4 lg:grid-rows-1'
const FUSION_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-6 lg:grid-rows-1'

function rowsOf(snap: SanitationSnapshot, key: CardDef['key']): Row[] {
  const m = snap.modules as SanitationSnapshot['modules'] & Record<string, Row[] | undefined>
  return m[key] ?? []
}

function Section({
  title,
  subtitle,
  gridClass,
  cards,
  snap,
  vendorSet,
  range,
}: {
  title: string
  subtitle: string
  gridClass: string
  cards: CardDef[]
  snap: SanitationSnapshot
  vendorSet: Set<string>
  range: { from?: string; to?: string }
}) {
  return (
    <section aria-label={title} className="flex shrink-0 flex-col gap-1 lg:min-h-0 lg:flex-1">
      <div className="flex shrink-0 items-baseline gap-2 px-0.5">
        <h2 className="text-[11px] font-extrabold uppercase tracking-wider text-slate-800">{title}</h2>
        <p className="text-[10px] font-medium text-slate-500">{subtitle}</p>
      </div>
      <div className={gridClass}>
        {cards.map((c) => {
          if (c.key === 'mps') {
            // Same as Page 1: MPS transactions + Reserved/Ready, with Rp.
            const m = aggregateCombined([snap.modules.mps, snap.modules.mpsReserved], vendorSet, range)
            return (
              <ModuleCard
                key={c.key}
                className="min-h-[11rem] lg:min-h-0"
                title={c.title}
                tone={c.tone}
                hint={c.hint}
                value={m.created}
                subValue={m.amount !== undefined ? formatIdr(m.amount) : undefined}
                dimmed={m.created === 0}
              >
                <StatusBreakdown statuses={m.statuses} total={m.created} title={c.title} tall={false} />
              </ModuleCard>
            )
          }
          const a = aggregate(rowsOf(snap, c.key), vendorSet, range)
          // Page 2 MPS Approved: of-Y = Page 1 MPS Fully Approved (modul `mps` yang sama).
          const page1Fa = c.ofFromPage1MpsFullyApproved
            ? (aggregate(snap.modules.mps ?? [], vendorSet, range).statuses.find((s) => s.label === MPS_FA)?.count ?? 0)
            : null
          let statuses = c.ofFromPage1MpsFullyApproved
            ? a.statuses.filter((s) => NETGEAR_MPS_STATUSES.has(s.label))
            : a.statuses
          const statusTotal = c.ofFromPage1MpsFullyApproved ? (page1Fa ?? a.created) : a.created
          // Kunci Not Sent = Page1 FA − (ACK Success + Waiting + Error) supaya total breakdown = of-Y Page 1.
          if (c.ofFromPage1MpsFullyApproved && page1Fa !== null) {
            const sent = statuses
              .filter((s) => s.label !== 'Not Sent')
              .reduce((sum, s) => sum + s.count, 0)
            const notSent = Math.max(0, page1Fa - sent)
            const rest = statuses.filter((s) => s.label !== 'Not Sent')
            statuses = notSent > 0 ? [...rest, { label: 'Not Sent', count: notSent, tone: 'wait' as const }] : rest
          }
          const notSentCount = c.excludeNotSent
            ? statuses.filter((s) => NOT_SENT_LABELS.has(s.label)).reduce((sum, s) => sum + s.count, 0)
            : 0
          const xCount = c.ofFromPage1MpsFullyApproved
            ? Math.max(0, statusTotal - notSentCount)
            : a.created - notSentCount
          const ofCount = statusTotal
          const missing = rowsOf(snap, c.key).length === 0
          return (
            <ModuleCard
              key={c.key}
              className="min-h-[11rem] lg:min-h-0"
              title={c.title}
              tone={c.tone}
              hint={c.hint}
              value={xCount}
              unit="system key"
              subValue={missing ? 'Awaiting snapshot refresh' : c.excludeNotSent ? `of ${fmt(ofCount)}` : undefined}
              dimmed={a.created === 0 && !c.ofFromPage1MpsFullyApproved}
            >
              <StatusBreakdown
                statuses={statuses}
                total={statusTotal}
                title={c.title}
                tall="compact"
                showBarAmounts={false}
                showAmountCol={false}
              />
            </ModuleCard>
          )
        })}
      </div>
    </section>
  )
}

function Skeleton() {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2" aria-busy="true" aria-label="Loading">
      <div className={NETGEAR_GRID}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="min-h-[8rem] animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className={FUSION_GRID}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="min-h-[8rem] animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  )
}

function Report() {
  const {
    data,
    isLoading,
    snap,
    vendorSet,
    options,
    selected,
    setSelected,
    selection,
    setSelection,
    range,
    rangeLabel,
    scope,
    today,
    refreshing,
    refreshMsg,
    refresh,
  } = useSanitationReport()

  const title = `Interface Health — Netgear & Fusion`
  const titleTooltip = `${scope} · ${title}`

  return (
    <SanitationShell
      title={title}
      titleTooltip={titleTooltip}
      options={options}
      selected={selected}
      onVendorsChange={setSelected}
      selection={selection}
      rangeLabel={rangeLabel}
      minDate={snap?.since ?? ''}
      maxDate={today}
      onDateChange={setSelection}
      stale={data?.stale}
      ageMinutes={data?.ageMinutes}
      updatedAt={snap?.generatedAt}
      refreshMsg={refreshMsg}
      refreshing={refreshing}
      onRefresh={refresh}
    >
      {isLoading && <Skeleton />}

      {!isLoading && !snap && (
        <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">
          Snapshot not available{data?.error ? ` (${data.error})` : ''}. Run <code>node scripts/sanitation-snapshot.mjs</code> or wait for the hourly job.
        </div>
      )}

      {snap && (
        <>
          <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto lg:overflow-hidden">
            <Section
              title="Netgear"
              subtitle="PMIS ↔ Netgear"
              gridClass={NETGEAR_GRID}
              cards={NETGEAR_CARDS}
              snap={snap}
              vendorSet={vendorSet}
              range={range}
            />
            <Section
              title="Fusion"
              subtitle="PMIS → Oracle Fusion"
              gridClass={FUSION_GRID}
              cards={FUSION_CARDS}
              snap={snap}
              vendorSet={vendorSet}
              range={range}
            />
          </div>

          <footer className="flex shrink-0 items-center justify-between text-[10px] text-slate-500">
            <span>
              Snapshot {new Date(snap.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
              {' · '}
              {fmt(NETGEAR_CARDS.length + FUSION_CARDS.length)} interface cards
            </span>
          </footer>
        </>
      )}
    </SanitationShell>
  )
}

export default function SanitationReportPage2() {
  return (
    <Suspense fallback={null}>
      <Report />
    </Suspense>
  )
}
