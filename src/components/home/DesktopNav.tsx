import Image from "next/image"
import Link from "next/link"

import { NavigationAction } from "@/types/home"
import { cn } from "@/lib/utils"

interface DesktopNavProps {
  actions: NavigationAction[]
  activeId?: string
  primaryAction: NavigationAction
  logoSrc?: string
  logoAlt?: string
}

export function DesktopNav({ actions, activeId, primaryAction, logoSrc, logoAlt = "Logo" }: DesktopNavProps) {
  const PrimaryIcon = primaryAction.icon

  return (
    <header className="hidden lg:flex lg:justify-center">
      <div className="fixed inset-x-0 top-0 z-30 flex justify-center bg-[#05050F]/95 backdrop-blur">
        <div className="flex w-full max-w-6xl items-center justify-between px-6 py-4 text-white">
          <div className="flex items-center gap-3">
            {logoSrc ? (
              <div className="relative h-10 w-36">
                <Image src={logoSrc} alt={logoAlt} fill className="object-contain" sizes="144px" priority />
              </div>
            ) : (
              <span className="text-lg font-semibold">Indosat Dashboard</span>
            )}
          </div>
          <nav className="flex items-center gap-8 text-sm font-medium">
            {actions.map((action) => {
              const Icon = action.icon
              const isActive = action.id === activeId

              return (
                <Link
                  key={action.id}
                  href={action.href}
                  className={cn(
                    "flex items-center gap-2 border-b-2 border-transparent pb-1 text-white/60 transition hover:text-white/90",
                    isActive && "border-white text-white",
                  )}
                >
                  <Icon className="size-4" aria-hidden="true" />
                  {action.label}
                </Link>
              )
            })}
          </nav>
          <Link
            href={primaryAction.href}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground shadow-lg shadow-primary/30 transition hover:bg-primary/90"
          >
            <PrimaryIcon className="size-4" aria-hidden="true" />
            {primaryAction.label}
          </Link>
        </div>
      </div>
    </header>
  )
}
