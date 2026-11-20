'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import type { ReactNode } from 'react'
import { DateFilter, type DateSelection } from '@/components/sanitation/DateFilter'
import { VendorFilter } from '@/components/sanitation/VendorFilter'

type VendorOpt = { code: string; name: string }

type Props = {
  title: string
  titleTooltip?: string
  options: VendorOpt[]
  selected: string[]
  onVendorsChange: (codes: string[]) => void
  selection: DateSelection
  rangeLabel: string
  minDate: string
  maxDate: string
  onDateChange: (v: DateSelection) => void
  stale?: boolean
  ageMinutes?: number | null
  updatedAt?: string | null
  refreshMsg: string | null
  refreshing: boolean
  onRefresh: () => void
  children: ReactNode
}

const TABS = [
  { href: '/sanitation-report', label: 'Page 1', match: (p: string) => p === '/sanitation-report' },
  { href: '/sanitation-report/page-2', label: 'Page 2', match: (p: string) => p.startsWith('/sanitation-report/page-2') },
] as const

export function SanitationShell({
  title,
  titleTooltip,
  options,
  selected,
  onVendorsChange,
  selection,
  rangeLabel,
  minDate,
  maxDate,
  onDateChange,
  stale,
  ageMinutes,
  updatedAt,
  refreshMsg,
  refreshing,
  onRefresh,
  children,
}: Props) {
  const pathname = usePathname()
  const params = useSearchParams()
  const qs = params.toString()
  const withQs = (href: string) => (qs ? `${href}?${qs}` : href)

  return (
    <div className="flex min-h-dvh flex-col bg-slate-50 text-slate-900 lg:h-dvh lg:overflow-hidden">
      <header className="z-20 shrink-0 border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] flex-col gap-2 px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-2 md:flex-nowrap">
            <h1 className="min-w-0 text-sm font-extrabold md:truncate sm:text-base" title={titleTooltip ?? title}>
              {title}
            </h1>
            <div className="flex shrink-0 flex-wrap items-center gap-2 md:flex-nowrap">
              {options.length > 0 && <VendorFilter options={options} selected={selected} onChange={onVendorsChange} />}
              {minDate && (
                <DateFilter value={selection} min={minDate} max={maxDate} label={rangeLabel} onChange={onDateChange} />
              )}
              {updatedAt && (
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    stale ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                  }`}
                >
                  {stale
                    ? `Stale · ${ageMinutes} min ago`
                    : `Updated ${new Date(updatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`}
                </span>
              )}
              <span role="status" aria-live="polite" className="text-xs font-semibold text-slate-600">
                {refreshMsg}
              </span>
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh data"
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600"
              >
                {refreshing ? 'Refreshing…' : 'Refresh'}
              </button>
            </div>
          </div>
          <nav aria-label="Sanitation pages" className="flex items-center gap-1">
            {TABS.map((tab) => {
              const active = tab.match(pathname)
              return (
                <Link
                  key={tab.href}
                  href={withQs(tab.href)}
                  aria-current={active ? 'page' : undefined}
                  className={`rounded-lg px-3 py-1 text-xs font-bold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-600 ${
                    active ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {tab.label}
                </Link>
              )
            })}
            <span className="ml-2 hidden text-[10px] font-semibold uppercase tracking-wide text-slate-400 sm:inline">
              {pathname.includes('page-2') ? 'Interface Health — Netgear & Fusion' : 'Transaction modules'}
            </span>
          </nav>
        </div>
      </header>
      <main className="mx-auto flex min-h-0 w-full max-w-[1600px] flex-1 flex-col gap-2 px-4 py-2">{children}</main>
    </div>
  )
}
