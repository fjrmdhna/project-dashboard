import Link from "next/link"

import { cn } from "@/lib/utils"

interface SectionHeaderProps {
  title: string
  actionLabel?: string
  actionHref?: string
  tone?: "light" | "dark"
}

export function SectionHeader({ title, actionLabel, actionHref, tone = "light" }: SectionHeaderProps) {
  const isDark = tone === "dark"

  return (
    <div className="flex items-center justify-between">
      <h3 className={cn("text-lg font-semibold", isDark ? "text-white" : "text-foreground")}>{title}</h3>
      {actionLabel && actionHref ? (
        <Link
          className={cn(
            "text-sm font-medium transition",
            isDark ? "text-white/80 hover:text-white" : "text-primary hover:text-primary/80",
          )}
          href={actionHref}
        >
          {actionLabel}
        </Link>
      ) : null}
    </div>
  )
}
