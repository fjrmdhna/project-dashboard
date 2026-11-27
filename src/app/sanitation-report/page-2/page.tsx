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
  key: ModuleKey | 'matcGr' | 'patpGi' | 'patpGr' | 'patpFa' | 'fusionFa' | 'fusionGr'
  title: string
  tone: ModuleCardTone
  hint: string
  /** Keep "not sent yet" statuses out of the big number; they stay in the "of" total. */
  excludeNotSent?: boolean
  /** of-Y = MPS Fully Approved count from Page 1 module `mps` (same source). */
  ofFromPage1MpsFullyApproved?: boolean
  /** Show Rp on big number, of-Y, status list, and bar (Fusion legs). */
  showAmounts?: boolean
}

const NETGEAR_CARDS: CardDef[] = [
  {
    // Identical to the MPS card on Page 1 (same modules, same aggregation, same hint).
    key: 'mps',
    title: 'MPS',
    tone: 'cyan',
    hint: MPS_CARD_HINT,
  },
  {
    key: 'netgearMpsApproved',
    title: 'MPS Approved Sent',
    tone: 'cyan',
    excludeNotSent: true,
    /** of-Y locked to Page 1 MPS Fully Approved (same module rows). */
    ofFromPage1MpsFullyApproved: true,
    hint: 'PMIS → Netgear outbound. Big number / Sent = Fully Approved keys with a real (non-backfill) export. The "of" number is Page 1 MPS Fully Approved minus Backfill (no ACK expected), so Sent + Not Sent = of. Backfill keys (file_name starts with backfill-) are excluded from of and listed separately under the card. ACK detail is on MPS Approved ACK.',
  },
  {
    key: 'netgearMpsApprovedAck',
    title: 'MPS Approved ACK',
    tone: 'teal',
    /** Same outbound source as Sent; big number = received ACK only. */
    hint: 'ACK for keys with a real (non-backfill) Netgear export. Backfill exports are excluded. Big number = ACK already received (Success + Error). "of" = Sent count from MPS Approved Sent. Breakdown still shows Waiting ACK.',
  },
  // After ACK: GREEN first, then MOS (ops order from Bari).
  {
    key: 'netgearTaggingGreen',
    title: 'Tagging GREEN',
    tone: 'orange',
    hint: 'Netgear GREEN tagging (PO+line mapped to system key). Big number = keys that have GREEN and MPS Approved ACK Success. "of" = all keys with MPS ACK Success (same source as MPS Approved ACK). Normal GREEN statuses are for that Success slice; Anomaly rows = GREEN keys without MPS ACK Success (Waiting ACK / ACK Error / no export).',
  },
  {
    key: 'netgearTaggingMos',
    title: 'Tagging MOS',
    tone: 'violet',
    hint: 'Netgear MOS tagging. Big number = system keys that have MOS and MPS Approved ACK Success. "of" = all keys with MPS ACK Success (same source as MPS Approved ACK). Normal MOS statuses are for that Success slice; Anomaly rows = MOS keys without MPS ACK Success (Waiting ACK / ACK Error / no export).',
  },
]

/** Fusion row: GR Material → Site Transfer → GI → GR Service → Fixed Asset. */
const FUSION_CARDS: CardDef[] = [
  {
    key: 'matcGr',
    title: 'GR Material',
    tone: 'violet',
    excludeNotSent: true,
    showAmounts: true,
    hint: 'Oracle Fusion INTINV-005 material files for Fully Approved MATC/BABT system keys. Rp = material-line MPS PO value only (qty × latest IDR net price). Status: Not Sent / Waiting ACK / ACK Success / ACK Error.',
  },
  {
    key: 'siteTransfer',
    title: 'Site Transfer',
    tone: 'orange',
    excludeNotSent: true,
    showAmounts: true,
    hint: 'Oracle Fusion INTINV-007. Same rules as Page 1: universe = done exports ∪ PMIS scheduler queue (MOS AF, Current≠Destination, Fusion PO). Not Sent = full scheduler queue (never exported or destination changed). Rp = transfer qty × price (sent) or needy-line PO value (Not Sent).',
  },
  {
    key: 'patpGi',
    title: 'GI Material',
    tone: 'cyan',
    excludeNotSent: true,
    showAmounts: true,
    hint: 'Oracle Fusion INTINV-006 for Fully Approved PATP system keys. Rp = material-line MPS PO value only (qty × latest IDR net price on the latest MPS transaction). Status: Not Sent / Waiting ACK / ACK Success / ACK Error.',
  },
  {
    key: 'fusionGr',
    title: 'GR Service',
    tone: 'teal',
    excludeNotSent: true,
    showAmounts: true,
    hint: 'Oracle Fusion INTINV-005 service files for Fully Approved PATP ∪ CAC system keys (each key once). Service lines from both sources are merged, then rolled up per key (ACK Error > Waiting ACK > ACK Success > Not Sent). Click Not Sent for reason breakdown. Rp = service-line MPS PO value only. Page 1 PATP/CAC mini-funnels stay separate.',
  },
  {
    key: 'fusionFa',
    title: 'Fixed Asset',
    tone: 'navy',
    excludeNotSent: true,
    showAmounts: true,
    hint: 'Oracle Fusion INTPPM-002 for Fully Approved PATP ∪ CAC system keys (each key once). Lines from both sources are merged, then rolled up per key (ACK Error > Waiting ACK > ACK Success > Not Sent). Rp = full MPS transaction PO value (material + service). Page 1 PATP/CAC mini-funnels stay separate.',
  },
]

const NOT_SENT_LABELS = new Set(['Not Sent'])
const BACKFILL_LABEL = 'Backfill (no ACK expected)'
/** Accept old snapshot label "Backfill" until refresh. */
const isBackfillStatus = (label: string) => label === BACKFILL_LABEL || label === 'Backfill'
const MPS_FA = 'MPS Fully Approved'
const NETGEAR_MPS_STATUSES = new Set([
  'ACK Success',
  'Waiting ACK',
  'ACK Error',
  'Backfill',
  BACKFILL_LABEL,
  'Not Sent',
])
/** Real Sent / ACK funnel (excludes Backfill). */
const NETGEAR_ACK_STATUSES = new Set(['ACK Success', 'Waiting ACK', 'ACK Error'])
/** ACK card big number: jawaban Netgear sudah masuk. */
const NETGEAR_RECEIVED_ACK = new Set(['ACK Success', 'ACK Error'])
const ACK_SUCCESS = 'ACK Success'
const TAGGING_ANOMALY_PREFIX = 'Anomaly:'
/**
 * One-screen layout (laptop 1920x1080 @150% => ~1245x590 viewport in Firefox):
 * lg+  : Netgear 5 across + Fusion 5 across, each section shares the remaining height.
 * <lg  : stacked cards, page scrolls.
 */
const NETGEAR_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-5 lg:grid-rows-1'
const FUSION_GRID =
  'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:min-h-0 lg:flex-1 lg:grid-cols-5 lg:grid-rows-1'

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
          if (c.key === 'netgearTaggingMos' || c.key === 'netgearTaggingGreen') {
            const tag = aggregate(rowsOf(snap, c.key), vendorSet, range)
            const ackSuccessOf = aggregate(rowsOf(snap, 'netgearMpsApproved'), vendorSet, range).statuses.find(
              (s) => s.label === ACK_SUCCESS,
            )?.count ?? 0
            const statuses = tag.statuses
            const xCount = statuses
              .filter((s) => !s.label.startsWith(TAGGING_ANOMALY_PREFIX))
              .reduce((sum, s) => sum + s.count, 0)
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
                stackLabel={
                  missing ? 'Awaiting snapshot refresh' : `with MPS ACK Success (of ${fmt(ackSuccessOf)})`
                }
                dimmed={xCount === 0}
              >
                <StatusBreakdown
                  statuses={statuses}
                  total={tag.created}
                  title={c.title}
                  tall="compact"
                  showBarAmounts={false}
                  showAmountCol={false}
                  anomalyPrefix={TAGGING_ANOMALY_PREFIX}
                />
              </ModuleCard>
            )
          }
          // Sent + ACK cards share one outbound source so totals cannot drift.
          const isNetgearMpsPair = c.key === 'netgearMpsApproved' || c.key === 'netgearMpsApprovedAck'
          const sourceKey = isNetgearMpsPair ? 'netgearMpsApproved' : c.key
          const a = aggregate(rowsOf(snap, sourceKey), vendorSet, range)
          const page1Fa = c.ofFromPage1MpsFullyApproved || isNetgearMpsPair
            ? (aggregate(snap.modules.mps ?? [], vendorSet, range).statuses.find((s) => s.label === MPS_FA)?.count ?? 0)
            : null
          let statuses =
            c.ofFromPage1MpsFullyApproved || isNetgearMpsPair
              ? a.statuses.filter((s) => NETGEAR_MPS_STATUSES.has(s.label))
              : a.statuses
          let statusTotal =
            c.ofFromPage1MpsFullyApproved || isNetgearMpsPair ? (page1Fa ?? a.created) : a.created
          // Not Sent = Page1 FA − (real Sent + Backfill).
          if ((c.ofFromPage1MpsFullyApproved || isNetgearMpsPair) && page1Fa !== null) {
            const accounted = statuses
              .filter((s) => s.label !== 'Not Sent')
              .reduce((sum, s) => sum + s.count, 0)
            const notSent = Math.max(0, page1Fa - accounted)
            const rest = statuses.filter((s) => s.label !== 'Not Sent')
            statuses = notSent > 0 ? [...rest, { label: 'Not Sent', count: notSent, tone: 'wait' as const }] : rest
          }
          // Real Sent = non-backfill export only (ACK Success / Waiting / Error).
          const sentCount = statuses
            .filter((s) => NETGEAR_ACK_STATUSES.has(s.label))
            .reduce((sum, s) => sum + s.count, 0)
          const backfillCount = statuses
            .filter((s) => isBackfillStatus(s.label))
            .reduce((sum, s) => sum + s.count, 0)
          // Sent card of-Y = FA − Backfill (Sent + Not Sent). ACK of-Y stays Sent.
          const ofCount =
            c.key === 'netgearMpsApproved' && page1Fa !== null
              ? Math.max(0, page1Fa - backfillCount)
              : statusTotal
          let xCount = c.excludeNotSent ? sentCount : a.created
          let sentStackLabel: string | undefined
          let sentAnomalyPrefix: string | undefined

          if (c.key === 'netgearMpsApproved') {
            // Funnel = Sent + Not Sent (= of). Backfill listed separately (excluded from of).
            const notSent = statuses.find((s) => NOT_SENT_LABELS.has(s.label))
            statuses = [
              ...(sentCount > 0 ? [{ label: 'Sent', count: sentCount, tone: 'ok' as const }] : []),
              ...(notSent && notSent.count > 0 ? [notSent] : []),
              ...(backfillCount > 0
                ? [{ label: BACKFILL_LABEL, count: backfillCount, tone: 'neutral' as const }]
                : []),
            ]
            statusTotal = ofCount
            xCount = sentCount
            sentAnomalyPrefix = backfillCount > 0 ? 'Backfill' : undefined
            sentStackLabel =
              backfillCount > 0
                ? `excl. Backfill ${fmt(backfillCount)} · no ACK expected`
                : undefined
          } else if (c.key === 'netgearMpsApprovedAck') {
            // List = ACK funnel for real Sent only; big number = received only.
            statuses = statuses.filter((s) => NETGEAR_ACK_STATUSES.has(s.label))
            statusTotal = sentCount
            xCount = statuses
              .filter((s) => NETGEAR_RECEIVED_ACK.has(s.label))
              .reduce((sum, s) => sum + s.count, 0)
          }

          const missing = rowsOf(snap, sourceKey).length === 0
          const isSentCard = c.key === 'netgearMpsApproved'
          const isAckCard = c.key === 'netgearMpsApprovedAck'
          const showRp = Boolean(c.showAmounts) && !missing
          const notSentAmount = statuses
            .filter((s) => NOT_SENT_LABELS.has(s.label))
            .reduce((sum, s) => sum + (s.amount ?? 0), 0)
          const ofAmount = a.amount
          const sentAmount =
            ofAmount !== undefined ? Math.max(0, ofAmount - notSentAmount) : undefined
          const ofLabelBase = `of ${fmt(isAckCard ? sentCount : ofCount)}`
          const ofLabel =
            showRp && ofAmount !== undefined ? `${ofLabelBase} · ${formatIdr(ofAmount)}` : ofLabelBase
          return (
            <ModuleCard
              key={c.key}
              className="min-h-[11rem] lg:min-h-0"
              title={c.title}
              tone={c.tone}
              hint={c.hint}
              value={xCount}
              unit={isSentCard ? 'system key sent' : isAckCard ? 'system key receive' : 'system key'}
              amountLabel={
                showRp && c.excludeNotSent && sentAmount !== undefined ? formatIdr(sentAmount) : undefined
              }
              subValue={
                missing
                  ? 'Awaiting snapshot refresh'
                  : c.excludeNotSent || isAckCard
                    ? ofLabel
                    : undefined
              }
              stackLabel={sentStackLabel}
              stackSub={showRp || Boolean(sentStackLabel)}
              dimmed={xCount === 0 && !c.ofFromPage1MpsFullyApproved && !isNetgearMpsPair}
            >
              <StatusBreakdown
                statuses={statuses}
                total={statusTotal}
                title={c.title}
                tall="compact"
                showBarAmounts={showRp}
                showAmountCol={showRp}
                anomalyPrefix={sentAnomalyPrefix}
                statusDrilldowns={
                  c.key === 'fusionGr'
                    ? {
                        'Not Sent': {
                          title: 'GR Service · Not Sent reasons',
                          statuses: aggregate(snap.modules.fusionGrNotSent ?? [], vendorSet, range).statuses,
                          emptyHint: 'Awaiting snapshot refresh',
                        },
                      }
                    : undefined
                }
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
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="min-h-[8rem] animate-pulse rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
      <div className={FUSION_GRID}>
        {Array.from({ length: 5 }).map((_, i) => (
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
