'use client'

import { Suspense, type ReactNode } from 'react'
import { PatpFusionMini } from '@/components/sanitation/GrPipeline'
import { ModuleCard, fmt, type ModuleCardTone } from '@/components/sanitation/ModuleCard'
import { SanitationShell } from '@/components/sanitation/SanitationShell'
import { StatusBreakdown } from '@/components/sanitation/StatusBreakdown'
import {
  aggregate,
  aggregateCombined,
  formatIdr,
  modulesWithTransactions,
  sumCount,
} from '@/lib/sanitation-report/aggregate'
import { MPS_CARD_HINT } from '@/lib/sanitation-report/hints'
import { CORE_MODULES, type ModuleKey } from '@/lib/sanitation-report/types'
import { useSanitationReport } from '@/lib/sanitation-report/useSanitationReport'

type CardDef = {
  key: ModuleKey
  title: string
  tone: ModuleCardTone
  unit?: string
  hint: string
}

/** Urutan tampilan = alur bisnis. Grid lg 12 kolom: baris 1 = 4 card, baris 2–3 = 3 card. */
const CARDS: CardDef[] = [
  { key: 'mps', title: 'MPS', tone: 'cyan', hint: MPS_CARD_HINT },
  { key: 'baseline', title: 'Baseline', tone: 'navy', hint: 'Counted per unique system key that already has an MPS transaction. A key counts if it appears on a Baseline module record or has any Master Tracker header containing "_bf" with a value. When both exist, status comes from the latest Baseline module record; Master Tracker-only keys use status "Has BF on Master tracker". The "of" number is the total MPS system keys including Reserved/Ready.' },
  { key: 'caf', title: 'CAF', tone: 'orange', hint: 'Counted per caf_no, current CAF status.' },
  { key: 'crRelocation', title: 'Change Request', tone: 'red', hint: 'Counted per CR number (type Relocation), latest status; vendor via system key.' },
  { key: 'matc', title: 'MATC / BABT', tone: 'violet', hint: 'Counted per unique system key. Status uses workflow priority across all MATC/BABT BAs for that key (Fully Approved > In Progress > Rejected > No Workflow). Only system keys that have an MPS transaction and at least one material line (not service-only) are counted; the "of" number is all such material-line system keys including Reserved/Ready. Rp beside the count = material-line PO value of those MATC system keys; Rp beside "of" = material-line PO value of the full material-line MPS universe (including Reserved/Ready). Fusion GR Material matches material INTINV-005 files across all Fully Approved MATC BAs for each system key.' },
  { key: 'siteTransfer', title: 'Site Transfer', tone: 'orange', hint: 'Site-to-site transfer to Oracle Fusion (INTINV-007). Universe = done exports ∪ PMIS scheduler queue (same rules as findMosReadyUnexportedKeys: MOS AF filled, Current≠Destination, Fusion/sap-fusion PO line, excluding PO-AUC migration). Big number = keys already exported and not still queued. Not Sent = full scheduler queue (never exported or destination changed). ACK from latest ACK per export line. Rp = transferred qty × PO net (IDR) for sent; needy-line PO value for Not Sent.' },
  { key: 'patp', title: 'Acceptance - PATP', tone: 'violet', hint: 'Counted per unique system key that Master Scope Acceptance requires for PATP. If any PATP for the key was Fully Approved, status stays Fully Approved; otherwise the latest acceptance status is used. The "of" number is MPS system keys (including Reserved/Ready) that require PATP per Master Scope Acceptance. Rp beside the count = Current Realisation on the preferred PATP (Fully Approved when present, else latest; mapped quantity x latest PO net price, IDR, PO-based lines only; WO-only has no value). Rp beside "of" = MPS/PO mapped value (all IDR lines) for every system key in that PATP-required universe when the snapshot includes that amount. Fusion funnel (Fully Approved keys): GI Material Rp = material MPS PO only; GR Service Rp = service MPS PO only; Fixed Asset Rp = full MPS transaction (material + service).' },
  { key: 'fatp', title: 'Acceptance - FATP', tone: 'cyan', hint: 'Counted per unique system key that Master Scope Acceptance requires for FATP, using its latest FATP acceptance (status of that acceptance). The "of" number is MPS system keys (including Reserved/Ready) that require FATP per Master Scope Acceptance (project type + scope category).' },
  { key: 'endorsement', title: 'Endorsement', tone: 'teal', hint: 'Counted per unique system key, using its latest endorsement (approval status of that system key).' },
  { key: 'cac', title: 'CAC Acceptance / BAUT', tone: 'teal', hint: 'Counted per unique system key. Status uses workflow priority across all CAC/BAUT BAs for that key (Fully Approved > In Progress > Rejected > No Workflow). The "of" number is the total MPS system keys including Reserved/Ready. Rp beside the count = Realisation of ATP Appendix 2 service lines only on the preferred BA for those CAC system keys; Rp beside "of" = service-line PO value for the full MPS universe (including Reserved/Ready). Fusion funnel matches all Fully Approved BAs for each system key.' },
]

const NOT_SENT = 'Not Sent'
const GRID = 'grid min-h-0 flex-1 grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-12 lg:grid-rows-3'
/** Baris 1 (index 0–3): span 3 → 4 card. Baris 2–3: span 4 → 3 card. String utuh untuk Tailwind JIT. */
const cardSpan = (index: number) => (index < 4 ? 'lg:col-span-3' : 'lg:col-span-4')

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
    periodText,
    scope,
    today,
    refreshing,
    refreshMsg,
    refresh,
  } = useSanitationReport()

  const cafWaiting = snap ? sumCount(snap.modules.cafAction, vendorSet, range) : 0
  const active = snap ? modulesWithTransactions(snap, vendorSet, range) : 0
  const title = `${scope} Transactions on PMIS ${periodText}`

  return (
    <SanitationShell
      title={title}
      titleTooltip={title}
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
          Snapshot belum tersedia{data?.error ? ` (${data.error})` : ''}. Jalankan <code>node scripts/sanitation-snapshot.mjs</code> atau
          tunggu job per jam.
        </div>
      )}

      {snap && (
        <>
          <div className="grid shrink-0 grid-cols-1 gap-2 lg:grid-cols-2">
            <div className="min-w-0 rounded-lg border-l-4 border-teal-600 bg-slate-900 px-3 py-1 text-[11px] font-bold text-white sm:text-xs lg:truncate">
              KEY FACT &nbsp;|&nbsp;{' '}
              {active === CORE_MODULES.length
                ? `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in all ${CORE_MODULES.length} modules.`
                : `${scope === 'All Vendor' ? 'All vendors have' : `${scope} has`} recorded transactions in ${active} of ${CORE_MODULES.length} modules.`}
            </div>
            <div className="min-w-0 rounded-lg border-l-4 border-rose-500 bg-rose-50 px-3 py-1 text-[11px] font-bold text-rose-700 sm:text-xs lg:truncate">
              CAF ACTION &nbsp;|&nbsp; {fmt(cafWaiting)} waiting submit Pictorial Reports{' '}
              <span className="font-normal">({selection.preset === 'all' ? 'all time' : rangeLabel.toLowerCase()})</span>.
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
              let note: ReactNode
              if (c.key === 'matc' && snap.modules.matcGr) {
                const gr = aggregate(snap.modules.matcGr, vendorSet, range)
                note = <PatpFusionMini total={gr.created} basis="Fully Approved system key" legs={[{ label: 'GR Material', interfaceId: 'INTINV-005', statuses: gr.statuses }]} />
              }
              if (c.key === 'cac' && snap.modules.cacGr && snap.modules.cacFa) {
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
                      : c.key === 'matc' && snap.modules.mpsMaterial
                        ? ofLabel(aggregate(snap.modules.mpsMaterial, vendorSet, range))
                        : c.key === 'siteTransfer'
                          ? ofLabel(a)
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
    </SanitationShell>
  )
}

export default function SanitationReportPage() {
  return (
    <Suspense fallback={null}>
      <Report />
    </Suspense>
  )
}
