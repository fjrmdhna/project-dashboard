"use client"

import { Button } from "@/components/ui/button"

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-end justify-start overflow-hidden">
      {/* Unicorn.studio Interactive Background Element */}
      <div 
        id="unicorn-studio-background"
        className="absolute inset-0 z-0"
        aria-label="Interactive background element for unicorn.studio integration"
      >
        {/* This div will contain the unicorn.studio interactive background */}
        {/* Placeholder for future integration */}
      </div>

      {/* Content Container */}
      <div className="relative z-10 w-full px-4 sm:px-6 lg:px-8 pb-16 lg:pb-24">
        <div className="container mx-auto">
          <div className="max-w-4xl">
            {/* Main Headline */}
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-tight mb-8 bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
              PROJECT DASHBOARD
            </h1>
            
            {/* Subtitle */}
            <p className="text-lg sm:text-xl lg:text-2xl text-muted-foreground mb-12 max-w-3xl font-mono">
              Centralized project management and analytics platform for Indosat Ooredoo Hutchison. Monitor progress, track performance, and drive success across all initiatives.
            </p>

            {/* CTA Button */}
            <Button 
              size="lg" 
              className="bg-primary hover:bg-primary/90 text-primary-foreground text-lg px-8 py-6 h-auto font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
            >
              Access Dashboard
            </Button>
          </div>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute bottom-0 left-0 w-full h-32 bg-gradient-to-t from-background to-transparent z-10" />
    </section>
  )
} 