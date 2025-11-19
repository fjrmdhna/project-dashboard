import Image from "next/image"

import { cn } from "@/lib/utils"

interface GreetingHeaderProps {
  name?: string
  message: string
  tone?: "light" | "dark"
  logoSrc?: string
  logoAlt?: string
  align?: "start" | "center"
  logoShift?: "none" | "right"
  className?: string
  logoClassName?: string
}

export function GreetingHeader({
  name,
  message,
  tone = "light",
  logoSrc,
  logoAlt = "Logo",
  align = "start",
  logoShift = "none",
  className,
  logoClassName,
}: GreetingHeaderProps) {
  const isDark = tone === "dark"
  const isCenter = align === "center"
  const shiftRight = logoShift === "right"

  return (
    <div className={cn("space-y-0.5", isCenter && "text-center", className)}>
      <p className={cn("text-sm", isDark ? "text-white/60" : "text-muted-foreground")}>Home</p>
      {logoSrc ? (
        <div
          className={cn(
            "relative h-10 w-32",
            logoClassName,
            isCenter && "mx-auto",
            shiftRight && "translate-x-4 sm:translate-x-6 lg:translate-x-8",
          )}
        >
          <Image src={logoSrc} alt={logoAlt} fill className="object-contain" sizes="128px" priority />
        </div>
      ) : (
        <h1 className={cn("text-2xl font-semibold tracking-tight", isDark ? "text-white" : "text-foreground")}>
          Hi {name}!
        </h1>
      )}
      <p className={cn("text-sm", isDark ? "text-white/70" : "text-muted-foreground")}>{message}</p>
    </div>
  )
}
