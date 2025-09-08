import { Navbar } from "@/components/navbar"
import { HeroSection } from "@/components/hero-section"
import { FeaturesSection } from "@/components/features-section"

export default function Home() {
  return (
    <main className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      
      {/* Additional sections can be added here */}
      {/* Pricing, Analytics, Integrations, Support */}
    </main>
  )
}
