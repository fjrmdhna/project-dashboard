import type { LucideIcon } from "lucide-react"

export type ProjectMood = "primary" | "neutral"

export interface ProjectCardData {
  id: string
  title: string
  category: string
  date: string
  progress: number
  mood?: ProjectMood
  href: string
  isDummy?: boolean // Flag untuk menandai card sebagai dummy/placeholder data
}

export interface HeroHighlight {
  eyebrow: string
  title: string
  description: string
  actionLabel: string
}

export interface NavigationAction {
  id: string
  label: string
  href: string
  icon: LucideIcon
}
