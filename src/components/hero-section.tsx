"use client"

import { ArrowRight } from "lucide-react"

import { DashboardCarousel } from "@/components/dashboard-carousel"

export function HeroSection() {
  return (
    <section className="relative flex min-h-screen items-stretch overflow-hidden">
      <div className="absolute inset-0">
        <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1526481280695-3c469928b67b?auto=format&fit=crop&w=1920&q=80')] bg-cover bg-center" />
        <div className="absolute inset-0 bg-gradient-to-r from-black via-black/70 to-black/40" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
      </div>

      <div className="relative z-10 flex w-full items-center">
        <div className="container mx-auto px-4 py-12 sm:px-6 md:py-16 lg:px-8 lg:py-24">
          <div className="flex flex-col gap-10 lg:flex-row lg:items-center lg:gap-16">
            <div className="max-w-2xl text-white">
              <span className="text-[11px] font-semibold uppercase tracking-[0.45em] text-white/70">
                Indosat Ooredoo Hutchison
              </span>
              <h1 className="mt-2 text-balance bg-[linear-gradient(90deg,#ff2cfb_0%,#c788ff_33%,#5de3db_66%,#ff80ff_100%)] bg-clip-text text-[clamp(2.25rem,5vw,4.25rem)] font-black uppercase leading-[0.92] tracking-[-0.015em] text-transparent">
                Network Deployment Dashboard
              </h1>
              <p className="mt-4 max-w-xl text-sm font-mono text-white/80 sm:text-base lg:text-lg">
                Centralized project management and analytics platform to monitor progress, track performance, and drive success across nationwide initiatives.
              </p>

              <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.5em] text-white/60">
                <span>Discover Programs</span>
                <ArrowRight aria-hidden className="h-4 w-4" />
              </div>
            </div>

            <div className="w-full max-w-4xl mx-auto lg:mx-0 lg:max-w-[60%] xl:max-w-[65%]">
              <DashboardCarousel variant="hero" hideHeading className="max-w-none" />
            </div>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-40 bg-gradient-to-t from-black via-black/40 to-transparent" />
    </section>
  )
}

