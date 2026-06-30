"use client"

import type { LucideIcon } from "lucide-react"
import type { ReactNode } from "react"

export type TlpCardTone = "purple" | "cyan" | "blue" | "amber" | "red" | "pink"

const TONE_ICON_BG: Record<TlpCardTone, string> = {
  purple: "bg-purple-500/20",
  cyan: "bg-cyan-500/20",
  blue: "bg-blue-500/20",
  amber: "bg-amber-500/20",
  red: "bg-red-500/20",
  pink: "bg-pink-500/20",
}

const TONE_ICON_TEXT: Record<TlpCardTone, string> = {
  purple: "text-purple-300",
  cyan: "text-cyan-300",
  blue: "text-blue-300",
  amber: "text-amber-300",
  red: "text-red-300",
  pink: "text-pink-300",
}

export const TLP_CARD_TITLE_CLASS =
  "block truncate text-[10px] font-semibold leading-tight text-white"

export const TLP_CARD_SUBTITLE_CLASS =
  "mt-0.5 truncate text-[8px] leading-tight text-[#B0B7C3]"

interface TlpCardHeaderProps {
  title: string
  icon?: LucideIcon
  tone?: TlpCardTone
  subtitle?: string
  leading?: ReactNode
  trailing?: ReactNode
  className?: string
}

export function TlpCardHeader({
  title,
  icon: Icon,
  tone = "blue",
  subtitle,
  leading,
  trailing,
  className = "mb-1.5",
}: TlpCardHeaderProps) {
  return (
    <div className={`flex shrink-0 items-center justify-between gap-2 ${className}`}>
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        {leading}
        {Icon ? (
          <div className={`shrink-0 rounded-md p-0.5 ${TONE_ICON_BG[tone]}`}>
            <Icon className={`h-3 w-3 ${TONE_ICON_TEXT[tone]}`} aria-hidden="true" />
          </div>
        ) : null}
        <div className="min-w-0">
          <span className={TLP_CARD_TITLE_CLASS} title={title}>
            {title}
          </span>
          {subtitle ? <p className={TLP_CARD_SUBTITLE_CLASS}>{subtitle}</p> : null}
        </div>
      </div>
      {trailing ? <div className="flex shrink-0 items-center gap-1.5">{trailing}</div> : null}
    </div>
  )
}

export function TlpCardHeaderPlanActual({
  plan,
  actual,
  planColor,
  actualColor,
}: {
  plan: number
  actual: number
  planColor: string
  actualColor: string
}) {
  return (
    <div className="flex shrink-0 items-center gap-1.5 whitespace-nowrap text-[9px] font-semibold leading-none text-white/80">
      <span>
        Plan: <span style={{ color: planColor }}>{plan.toLocaleString()}</span>
      </span>
      <span className="text-white/35" aria-hidden="true">
        |
      </span>
      <span>
        Actual: <span style={{ color: actualColor }}>{actual.toLocaleString()}</span>
      </span>
    </div>
  )
}

export function TlpCardHeaderTotalBadge({
  total,
  tone = "cyan",
  label = "Total",
}: {
  total: number
  tone?: TlpCardTone
  label?: string
}) {
  const borderTone: Record<TlpCardTone, string> = {
    purple: "border-purple-500/25 bg-purple-500/10",
    cyan: "border-cyan-500/25 bg-cyan-500/10",
    blue: "border-blue-500/25 bg-blue-500/10",
    amber: "border-amber-500/25 bg-amber-500/10",
    red: "border-red-500/25 bg-red-500/10",
    pink: "border-pink-500/25 bg-pink-500/10",
  }

  const valueTone: Record<TlpCardTone, string> = {
    purple: "text-purple-300",
    cyan: "text-cyan-300",
    blue: "text-blue-300",
    amber: "text-amber-300",
    red: "text-red-300",
    pink: "text-pink-300",
  }

  return (
    <div
      className={`rounded-md border px-1.5 py-px text-[8px] text-white/80 ${borderTone[tone]}`}
    >
      {label}: <span className={`font-bold ${valueTone[tone]}`}>{total.toLocaleString()}</span>
    </div>
  )
}
