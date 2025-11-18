import Link from "next/link"
import { NavigationAction } from "@/types/home"
import { cn } from "@/lib/utils"

interface BottomNavProps {
  actions: NavigationAction[]
  primaryAction: NavigationAction
  activeId?: string
}

export function BottomNav({ actions, primaryAction, activeId }: BottomNavProps) {
  const PrimaryIcon = primaryAction.icon

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-20 flex justify-center px-6 pb-6">
      <nav className="pointer-events-auto relative flex w-full max-w-md items-center justify-around rounded-full bg-card px-6 py-4 text-muted-foreground shadow-2xl">
        {actions.map((action) => {
          const Icon = action.icon
          const isActive = action.id === activeId

          return (
            <Link
              key={action.id}
              href={action.href}
              className={cn(
                "flex flex-col items-center text-xs font-medium transition",
                isActive ? "text-primary" : "text-muted-foreground",
              )}
              aria-label={action.label}
              aria-current={isActive ? "page" : undefined}
            >
              <Icon className="mb-1 size-4" aria-hidden="true" />
              {action.label}
            </Link>
          )
        })}
        <Link
          href={primaryAction.href}
          aria-label={primaryAction.label}
          className="absolute left-1/2 top-0 flex -translate-y-1/2 -translate-x-1/2 items-center justify-center rounded-full bg-primary p-4 text-primary-foreground shadow-xl transition hover:bg-primary/90"
        >
          <PrimaryIcon className="size-5" aria-hidden="true" />
        </Link>
      </nav>
    </div>
  )
}
