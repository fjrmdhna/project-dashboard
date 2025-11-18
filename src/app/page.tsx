import { Briefcase, Home as HomeIcon, Map, Plus, Users } from "lucide-react"

import { BottomNav } from "@/components/home/BottomNav"
import { GreetingHeader } from "@/components/home/GreetingHeader"
import { HeroCard } from "@/components/home/HeroCard"
import { ProjectCard } from "@/components/home/ProjectCard"
import { SearchInput } from "@/components/home/SearchInput"
import { SectionHeader } from "@/components/home/SectionHeader"
import { HeroHighlight, NavigationAction, ProjectCardData } from "@/types/home"

const heroHighlight: HeroHighlight = {
  eyebrow: "Welcome!",
  title: "Let’s schedule your projects",
  description: "Prioritize the high-impact initiatives for this week and keep all stakeholders aligned.",
  actionLabel: "Create plan",
}

const projects: ProjectCardData[] = [
  {
    id: "mobile-app",
    title: "Mobile App",
    category: "E-Commerce",
    date: "May 30, 2022",
    progress: 50,
    mood: "primary",
  },
  {
    id: "dashboard",
    title: "Dashboard",
    category: "Retail",
    date: "May 30, 2022",
    progress: 80,
  },
  {
    id: "banner",
    title: "Banner",
    category: "Marketing",
    date: "May 30, 2022",
    progress: 40,
  },
  {
    id: "uiux",
    title: "UI/UX",
    category: "Task Manager",
    date: "May 30, 2022",
    progress: 60,
  },
]

const navActions: NavigationAction[] = [
  { id: "home", label: "Home", href: "/", icon: HomeIcon },
  { id: "projects", label: "Project", href: "/projects", icon: Briefcase },
  { id: "vendor", label: "Vendor", href: "/vendors", icon: Users },
  { id: "map", label: "Map", href: "/hermes-5g/map", icon: Map },
]

const primaryNavAction: NavigationAction = {
  id: "create",
  label: "Create",
  href: "/projects/new",
  icon: Plus,
}

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#05050F]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#1f1b3f,transparent_60%)]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-gradient-to-br from-[#ff2cfb]/30 via-[#5de3db]/30 to-transparent blur-[120px]"
        aria-hidden="true"
      />
      <div className="relative z-10 mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-32 pt-10 text-white">
        <div className="flex flex-1 flex-col gap-6">
          <GreetingHeader
            message="Semangat Pagi!"
            tone="dark"
            logoSrc="/logo-indosat-putih.png"
            logoAlt="Indosat Ooredoo Hutchison"
            align="center"
          />
          <SearchInput label="Search" tone="dark" />
          <HeroCard highlight={heroHighlight} />
          <section className="space-y-4">
            <SectionHeader title="Ongoing Projects" actionLabel="View all" actionHref="/projects" tone="dark" />
            <div className="grid grid-cols-2 gap-4">
              {projects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          </section>
        </div>
      </div>
      <BottomNav actions={navActions} primaryAction={primaryNavAction} activeId="home" />
    </main>
  )
}
