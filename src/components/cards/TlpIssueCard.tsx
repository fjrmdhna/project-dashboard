"use client"

import { useEffect, useMemo, useState } from "react"
import { AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react"
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts"
import type { TlpIssueCategoryRow } from "@/lib/tlp-issue-category"
import { TlpCardHeader } from "@/components/cards/tlp/TlpCardHeader"

const ROWS_PER_PAGE = 5

interface TlpIssueCardProps {
  issues: TlpIssueCategoryRow[]
  totalIssues: number
  categoryCount?: number
  isLoading?: boolean
}

function PaginationControls({
  pageIndex,
  totalPages,
  onPrev,
  onNext,
}: {
  pageIndex: number
  totalPages: number
  onPrev: () => void
  onNext: () => void
}) {
  if (totalPages <= 1) return null

  return (
    <div className="flex shrink-0 items-center gap-0.5 text-[9px] text-white/60">
      <button
        type="button"
        onClick={onPrev}
        disabled={pageIndex === 0}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Previous page"
      >
        <ChevronLeft className="h-3 w-3" />
      </button>
      <span className="min-w-[2.25rem] text-center tabular-nums">
        {pageIndex + 1}/{totalPages}
      </span>
      <button
        type="button"
        onClick={onNext}
        disabled={pageIndex >= totalPages - 1}
        className="flex h-5 w-5 items-center justify-center rounded-full border border-white/20 bg-white/5 transition hover:bg-white/15 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Next page"
      >
        <ChevronRight className="h-3 w-3" />
      </button>
    </div>
  )
}

export function TlpIssueCard({
  issues,
  totalIssues,
  categoryCount,
  isLoading = false,
}: TlpIssueCardProps) {
  const [pageIndex, setPageIndex] = useState(0)

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(issues.length / ROWS_PER_PAGE)),
    [issues.length]
  )

  const safePageIndex = Math.min(pageIndex, Math.max(0, totalPages - 1))

  useEffect(() => {
    setPageIndex(0)
  }, [issues])

  useEffect(() => {
    if (pageIndex >= totalPages) {
      setPageIndex(Math.max(0, totalPages - 1))
    }
  }, [pageIndex, totalPages])

  const pageRows = useMemo(() => {
    const start = safePageIndex * ROWS_PER_PAGE
    return issues.slice(start, start + ROWS_PER_PAGE)
  }, [issues, safePageIndex])

  const typesCount = categoryCount ?? issues.length

  const showLoading = isLoading && issues.length === 0

  const renderSliceLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index }: any) => {
    if (isLoading || issues.length === 0 || percent < 0.05) return null

    const radius = innerRadius + (outerRadius - innerRadius) * 0.6
    const x = cx + radius * Math.cos(-midAngle * (Math.PI / 180))
    const y = cy + radius * Math.sin(-midAngle * (Math.PI / 180))

    return (
      <text
        x={x}
        y={y}
        fill="#FFFFFF"
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={10}
        fontWeight={500}
        style={{
          filter: "drop-shadow(0px 0px 1px rgba(0,0,0,0.7))",
          textShadow: "0px 0px 2px rgba(0,0,0,0.7)",
        }}
      >
        {issues[index]?.count}
      </text>
    )
  }

  const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: TlpIssueCategoryRow }> }) => {
    if (!active || !payload?.length) return null
    const item = payload[0].payload
    const percentage = totalIssues > 0 ? ((item.count / totalIssues) * 100).toFixed(1) : "0.0"

    return (
      <div className="rounded-md border border-white/10 bg-[#1A2340] px-2 py-1.5 text-[10px]">
        <p className="mb-0.5 text-[11px] font-semibold text-white/90">{item.category}</p>
        <p className="text-[9px] text-white/80">Count: {item.count}</p>
        <p className="text-[9px] text-white/80">Percentage: {percentage}%</p>
      </div>
    )
  }

  const issueHeaderTrailing = (
    <div className="flex shrink-0 items-end gap-1.5">
      <div className="text-right">
        <div className="text-sm font-bold text-white">{totalIssues.toLocaleString()}</div>
        <div className="text-[8px] text-[#B0B7C3]">Total Issue</div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold text-white">{typesCount.toLocaleString()}</div>
        <div className="text-[8px] text-[#B0B7C3]">Categories</div>
      </div>
    </div>
  )

  if (showLoading) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-white/5 bg-[#0F1630]/80 p-1.5">
        <TlpCardHeader title="Issues" icon={AlertTriangle} tone="red" />
        <div className="flex flex-1 items-center justify-center text-xs text-white/50">Loading...</div>
      </div>
    )
  }

  if (issues.length === 0) {
    return (
      <div className="flex h-full min-h-0 w-full flex-col rounded-xl border border-white/5 bg-[#0F1630]/80 p-1.5">
        <TlpCardHeader title="Issues" icon={AlertTriangle} tone="red" />
        <div className="flex flex-1 items-center justify-center text-xs text-white/50">No issues found for current filter</div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col rounded-xl border border-white/5 bg-[#0F1630]/80 p-1.5">
      <TlpCardHeader
        title="Issues"
        icon={AlertTriangle}
        tone="red"
        trailing={issueHeaderTrailing}
      />

      <div className="flex min-h-0 flex-1 flex-col gap-0 md:flex-row">
        <div className="min-h-0 flex-1 md:w-1/2">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={issues}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={renderSliceLabel}
                outerRadius="90%"
                innerRadius="50%"
                dataKey="count"
                stroke="#0F1630"
                strokeWidth={1}
                isAnimationActive={false}
              >
                {issues.map((entry, index) => (
                  <Cell key={`${entry.category}-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip content={<CustomTooltip />} />
            </PieChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-1.5 flex min-h-0 min-w-0 flex-1 flex-col md:mt-0 md:w-1/2">
          <div className="mb-0.5 flex items-center justify-between gap-1">
            <div className="text-[10px] font-semibold text-white">All Issues</div>
            <PaginationControls
              pageIndex={safePageIndex}
              totalPages={totalPages}
              onPrev={() => setPageIndex((prev) => Math.max(0, prev - 1))}
              onNext={() => setPageIndex((prev) => Math.min(totalPages - 1, prev + 1))}
            />
          </div>

          <div className="min-h-0 flex-1 space-y-0.5 overflow-hidden">
            {pageRows.map((issue) => (
              <div key={issue.category} className="flex items-start gap-1">
                <div
                  className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: issue.color }}
                />
                <div className="flex-1 break-words text-[8px] leading-tight text-[#B0B7C3]" title={issue.category}>
                  {issue.category} [{issue.count}]
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
