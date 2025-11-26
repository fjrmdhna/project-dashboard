import Link from "next/link"

import { ProjectCardData } from "@/types/home"
import { cn } from "@/lib/utils"

interface ProjectCardProps {
  project: ProjectCardData
}

export function ProjectCard({ project }: ProjectCardProps) {
  const isPrimary = project.mood === "primary"
  const isDummy = project.isDummy === true

  return (
    <Link
      href={project.href}
      className={cn(
        "relative flex flex-col gap-3 rounded-3xl border border-slate-100 bg-white p-4 text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60",
        isPrimary && "border-transparent bg-gradient-to-b from-white to-white/90 shadow-lg ring-2 ring-primary/30",
        isDummy && "opacity-90",
      )}
    >
      {isDummy && (
        <span
          className="absolute right-2 top-2 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-700"
          title="Placeholder data"
          aria-label="Placeholder data"
        >
          Demo
        </span>
      )}
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide">
        <span className="text-slate-500">{project.date}</span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px]",
            isPrimary ? "bg-primary/10 text-primary" : "bg-slate-100 text-slate-600",
          )}
        >
          {project.category}
        </span>
      </div>
      <div>
        <h4 className="text-base font-semibold leading-tight">{project.title}</h4>
        <p className="text-xs text-slate-500">Progress</p>
      </div>
      <div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
          <div
            className={cn(
              "h-full rounded-full transition-all",
              isPrimary ? "bg-gradient-to-r from-[#ff2cfb] to-[#5de3db]" : "bg-primary",
            )}
            style={{ width: `${project.progress}%` }}
            aria-valuenow={project.progress}
            aria-valuemin={0}
            aria-valuemax={100}
            role="progressbar"
          />
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-900">{project.progress}%</p>
      </div>
    </Link>
  )
}
