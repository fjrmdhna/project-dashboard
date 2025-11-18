import { Search } from "lucide-react"
import { forwardRef, type InputHTMLAttributes } from "react"

import { cn } from "@/lib/utils"

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & {
  label?: string
  tone?: "light" | "dark"
}

export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, label = "Search", tone = "light", ...props }, ref) => {
    const isDark = tone === "dark"

    return (
      <label
        className={cn(
          "flex items-center gap-3 rounded-full px-4 py-3 shadow-lg",
          isDark ? "bg-white" : "bg-muted",
        )}
      >
        <Search
          className={cn("size-4", isDark ? "text-slate-500" : "text-muted-foreground")}
          aria-hidden="true"
        />
        <input
          ref={ref}
          className={cn(
            "flex-1 bg-transparent text-sm font-medium placeholder:text-muted-foreground focus-visible:outline-none",
            isDark ? "text-slate-900 placeholder:text-slate-400" : "text-foreground",
            className,
          )}
          type="search"
          placeholder={label}
          {...props}
        />
      </label>
    )
  },
)

SearchInput.displayName = "SearchInput"
