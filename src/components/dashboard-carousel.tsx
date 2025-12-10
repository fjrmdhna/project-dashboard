"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { ChevronLeft, ChevronRight } from "lucide-react"

import { cn } from "@/lib/utils"

interface DashboardCardData {
  id: string
  name: string
  tagline: string
  description: string
  href: string
  image: string
  accent: string
}

const DASHBOARDS: DashboardCardData[] = [
  {
    id: "hermes-5g",
    name: "Hermes 5G",
    tagline: "Network Migration",
    description: "Realtime oversight for nationwide 5G rollout metrics.",
    href: "/hermes-5g",
    image: "/Hermes_thumbnail.png",
    accent: "Jakarta, Indonesia"
  },
  {
    id: "new-site",
    name: "New Site",
    tagline: "New Site Operations",
    description: "Operational planning hub for aligning regional execution.",
    href: "/new-site",
    image: "/AOP_thumbnail.png",
    accent: "Bandung, Indonesia"
  },
  {
    id: "cme",
    name: "CME",
    tagline: "Infra Delivery",
    description: "End-to-end visibility for civil, mechanical, electrical tasks.",
    href: "#",
    image: "/CME_thumbnail.png",
    accent: "Makassar, Indonesia"
  },
  {
    id: "tlm",
    name: "TLM",
    tagline: "Tower Lifecycle",
    description: "Asset lifecycle intelligence for upgrade and maintenance.",
    href: "/tlm",
    image: "/TLM_thumbnail.png",
    accent: "Surabaya, Indonesia"
  }
]

type DashboardCarouselProps = {
  className?: string
  hideHeading?: boolean
  compact?: boolean
  variant?: "default" | "hero"
}

function DashboardCard({
  dashboard,
  heroMode = false
}: {
  dashboard: DashboardCardData
  heroMode?: boolean
}) {
  return (
    <Link
      href={dashboard.href}
      className={cn(
        "group relative flex h-64 min-h-[16rem] w-full overflow-hidden rounded-[28px] border border-white/10 bg-[#081025] text-white shadow-[0_25px_50px_-20px_rgba(15,23,42,0.7)] sm:h-72 sm:min-h-[18rem]",
        heroMode &&
          "border-white/20 bg-white/10 text-white shadow-[0_35px_60px_-25px_rgba(0,0,0,0.65)] backdrop-blur-md"
      )}
    >
      <div
        className={cn(
          "absolute inset-0 scale-105 bg-cover bg-center opacity-80 transition-transform duration-500 group-hover:scale-110",
          heroMode && "opacity-90"
        )}
        style={{ backgroundImage: `url(${dashboard.image})` }}
      />
      <div
        className={cn(
          "absolute inset-0 bg-gradient-to-b from-black/20 via-black/45 to-black/85",
          heroMode && "from-black/10 via-black/40 to-black/80"
        )}
      />

      <div className="relative flex h-full w-full flex-col justify-between p-6">
        <div className="space-y-3">
          <h3 className="text-xl font-semibold leading-tight sm:text-2xl">
            {dashboard.name}
          </h3>
          <p className="max-w-[18rem] text-sm text-white/80 sm:text-base">
            {dashboard.description}
          </p>
        </div>
      </div>

      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-100",
          heroMode && "opacity-100"
        )}
      />
    </Link>
  )
}

export function DashboardCarousel({
  className,
  hideHeading = false,
  compact,
  variant = "default"
}: DashboardCarouselProps = {}) {
  const isHero = variant === "hero"
  const isCompact = compact ?? isHero
  const showHeading = !hideHeading && !isHero

  const [visibleCount, setVisibleCount] = useState(1)
  const [currentSlide, setCurrentSlide] = useState(0)

  useEffect(() => {
    function updateVisibleCount() {
      if (typeof window === "undefined") return
      const width = window.innerWidth

      if (width >= 1400) {
        setVisibleCount(4)
      } else if (width >= 1024) {
        setVisibleCount(3)
      } else if (width >= 640) {
        setVisibleCount(2)
      } else {
        setVisibleCount(1)
      }
    }

    updateVisibleCount()
    window.addEventListener("resize", updateVisibleCount)
    return () => window.removeEventListener("resize", updateVisibleCount)
  }, [])

  const slides = useMemo(() => {
    const chunked: DashboardCardData[][] = []
    for (let i = 0; i < DASHBOARDS.length; i += visibleCount) {
      chunked.push(DASHBOARDS.slice(i, i + visibleCount))
    }
    return chunked
  }, [visibleCount])

  useEffect(() => {
    setCurrentSlide(0)
  }, [visibleCount])

  const totalSlides = slides.length

  const handlePrev = () => {
    setCurrentSlide(prev => (prev === 0 ? prev : prev - 1))
  }

  const handleNext = () => {
    setCurrentSlide(prev => (prev >= totalSlides - 1 ? prev : prev + 1))
  }

  const indicator = String(currentSlide + 1).padStart(2, "0")
  const indicatorTotal = String(totalSlides).padStart(2, "0")

  return (
    <section
      className={cn(
        "relative mx-auto mt-16 w-full max-w-6xl px-4",
        isCompact && "mt-0 max-w-none px-0",
        isHero && "mx-0 lg:px-0",
        className
      )}
    >
      <div
        className={cn(
          "relative overflow-hidden rounded-[32px] border border-white/10 bg-[#050B1D] px-6 py-10 text-white",
          isCompact && "rounded-[28px] px-4 py-6",
          isHero &&
            "rounded-[32px] border-white/20 bg-white/10 px-5 py-6 text-white/95 shadow-[0_35px_60px_-25px_rgba(0,0,0,0.6)] backdrop-blur-lg sm:px-6 sm:py-8 lg:px-8"
        )}
      >
        <div
          className={cn(
            "absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(58,122,254,0.18),_transparent_55%)]",
            isHero && "bg-gradient-to-r from-white/15 via-white/5 to-transparent"
          )}
        />

        {showHeading && (
          <header className="relative flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-[0.4em] text-white/50">Dashboard Collection</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">Explore Programs</h2>
            </div>
          </header>
        )}

        <div
          className={cn(
            "relative",
            showHeading ? "mt-8" : "mt-4",
            isHero && "mt-2 lg:mt-4"
          )}
        >
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500"
              style={{ transform: `translateX(-${currentSlide * 100}%)` }}
            >
              {slides.map((group, idx) => (
                <div key={idx} className="w-full flex-shrink-0 px-1">
                  <div
                    className="grid gap-4"
                    style={{ gridTemplateColumns: `repeat(${group.length}, minmax(0, 1fr))` }}
                  >
                    {group.map(dashboard => (
                      <DashboardCard
                        key={dashboard.id}
                        dashboard={dashboard}
                        heroMode={isHero}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            className={cn(
              "pointer-events-none absolute inset-x-0 top-0 h-full bg-gradient-to-r from-[#050B1D] via-transparent to-[#050B1D] opacity-50",
              isHero && "from-black/20 via-transparent to-black/20 opacity-70"
            )}
          />

          <div className="absolute bottom-4 left-4 flex items-center gap-3">
            <button
              type="button"
              onClick={handlePrev}
              disabled={currentSlide === 0}
              className={cn(
                "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition disabled:opacity-40",
                isHero && "border-white/30 bg-black/40 backdrop-blur-md hover:bg-black/50"
              )}
              aria-label="Previous dashboard"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={handleNext}
              disabled={currentSlide >= totalSlides - 1}
              className={cn(
                "pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-white/5 text-white transition disabled:opacity-40",
                isHero && "border-white/30 bg-black/40 backdrop-blur-md hover:bg-black/50"
              )}
              aria-label="Next dashboard"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          <div
            className={cn(
              "absolute bottom-4 right-6 text-3xl font-semibold tracking-[0.2em] text-white/70",
              isHero && "text-white/80"
            )}
          >
            {indicator}
            <span className="text-base align-super text-white/40">/{indicatorTotal}</span>
          </div>
        </div>
      </div>
    </section>
  )
}

