import { Briefcase, Home as HomeIcon, Map, Users } from "lucide-react"

import { BottomNav } from "@/components/home/BottomNav"
import { DesktopNav } from "@/components/home/DesktopNav"
import { GreetingHeader } from "@/components/home/GreetingHeader"
import { HeroCard } from "@/components/home/HeroCard"
import { ProjectCard } from "@/components/home/ProjectCard"
import { SearchInput } from "@/components/home/SearchInput"
import { SectionHeader } from "@/components/home/SectionHeader"
import { HeroHighlight, NavigationAction, ProjectCardData } from "@/types/home"
import { getProjectProgress } from "@/lib/project-progress"

const heroHighlight: HeroHighlight = {
  eyebrow: "Explore",
  title: "View site locations on map",
  description: "Track and visualize all site deployments across Indonesia with interactive map view.",
  actionLabel: "Open map",
  href: "/map",
}


const navActions: NavigationAction[] = [
  { id: "home", label: "Home", href: "/", icon: HomeIcon },
  { id: "projects", label: "Project", href: "/projects", icon: Briefcase },
  { id: "vendor", label: "Vendor", href: "/vendors", icon: Users },
  { id: "map", label: "Map", href: "/map", icon: Map },
]

export default async function Home() {
  // Fetch progress real untuk Hermes 5G
  // All data included - no exclusions
  let hermesProgress = 0
  try {
    const hermesProgressData = await getProjectProgress("site_data_5g")
    hermesProgress = hermesProgressData.progress
  } catch (error) {
    console.error("Error fetching Hermes 5G progress:", error)
    // Fallback ke 0 jika error
  }

  // Fetch progress real untuk AOP dari site_data_aop
  // Mengambil semua data AOP tanpa filter spesifik
  let aopProgress = 0
  try {
    const aopProgressData = await getProjectProgress("site_data_aop")
    aopProgress = aopProgressData.progress
  } catch (error) {
    console.error("Error fetching AOP progress:", error)
    // Fallback ke 0 jika error
  }

  // Build projects array dengan data real untuk Hermes 5G dan AOP
  const projects: ProjectCardData[] = [
    {
      id: "hermes",
      title: "Hermes 5G",
      category: "RAN",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      progress: hermesProgress,
      mood: "primary",
      href: "/hermes-5g",
    },
    {
      id: "aop",
      title: "AOP",
      category: "RAN",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      progress: aopProgress,
      mood: "primary",
      href: "/aop",
    },
    {
      id: "tlp-new-site",
      title: "TLP New Site",
      category: "RAN",
      date: new Date().toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      }),
      progress: 0,
      mood: "primary",
      href: "/tlp-new-site",
    },
  ]

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05050F]">
      <DesktopNav
        actions={navActions}
        activeId="home"
        logoSrc="/logo-indosat-putih.png"
        logoAlt="Indosat Ooredoo Hutchison"
      />
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1f1b3f,transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-[#ff2cfb]/30 via-[#5de3db]/30 to-transparent blur-[120px]"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 pb-32 pt-10 text-white lg:pb-16 lg:pt-32 lg:px-6">
        <div className="flex flex-1 flex-col gap-6 lg:grid lg:grid-cols-[1.2fr_0.9fr] lg:gap-12">
          <div className="space-y-6">
            <GreetingHeader
              message="Semangat Pagi!"
              tone="dark"
              logoSrc="/logo-indosat-putih.png"
              logoAlt="Indosat Ooredoo Hutchison"
              align="center"
              logoShift="right"
              logoClassName="lg:w-48 lg:h-14"
              className="lg:text-left"
            />
            <div className="lg:hidden">
              <SearchInput label="Search" tone="dark" />
            </div>
            <HeroCard highlight={heroHighlight} />
            <section className="space-y-4 lg:hidden">
              <SectionHeader title="Ongoing Projects" actionLabel="View all" actionHref="/projects" tone="dark" />
              <div className="grid grid-cols-2 gap-4">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          </div>

          <div className="hidden space-y-6 lg:flex lg:flex-col">
            <SearchInput label="Search projects, vendors..." tone="dark" className="text-base" />
            <section className="space-y-4 rounded-3xl bg-white/5 p-6 shadow-lg shadow-black/20 backdrop-blur">
              <SectionHeader title="Ongoing Projects" actionLabel="View all" actionHref="/projects" tone="dark" />
              <div className="grid grid-cols-2 gap-5">
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
      <div className="lg:hidden">
        <BottomNav actions={navActions} activeId="home" />
      </div>
    </main>
  )
}
