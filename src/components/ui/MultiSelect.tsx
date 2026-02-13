"use client"

import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import { createPortal, flushSync } from "react-dom"
import { Check, ChevronDown, X } from "lucide-react"

export interface MultiSelectProps {
  options: string[]
  selected: string[]
  placeholder?: string
  onChange: (selected: string[]) => void
  className?: string
  disabled?: boolean
  width?: string
  /** When true, button label always shows placeholder (e.g. "Vendor"); when false, shows selection count or value. Default false. */
  staticLabel?: boolean
}

export function MultiSelect({
  options,
  selected,
  placeholder = "Select",
  onChange,
  className = "",
  disabled = false,
  width = "auto",
  staticLabel = false
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0, alignRight: false })
  const [isMounted, setIsMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")
  
  // FIX: Use ref to always get latest selected value to prevent stale closure
  // This fixes the issue where rapid clicks use outdated selected array
  const selectedRef = useRef(selected)
  selectedRef.current = selected

  // Update menu position when button is clicked
  const updateMenuPosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const desiredWidth = Math.max(200, rect.width)
    const viewportWidth = window.innerWidth
    const spaceOnRight = viewportWidth - rect.left - desiredWidth

    setMenuPosition({
      top: rect.bottom + window.scrollY + 4,
      left: spaceOnRight >= 0 ? rect.left + window.scrollX : rect.right + window.scrollX - desiredWidth,
      width: desiredWidth,
      alignRight: spaceOnRight < 0
    })
  }

  // Handle toggle dropdown - keep interaction snappy
  const handleToggle = () => {
    if (disabled) return
    if (!open) {
      updateMenuPosition()
      // Use flushSync so the menu appears immediately after click,
      // avoiding any visual delay from concurrent React rendering.
      flushSync(() => {
        setOpen(true)
      })
    } else {
      setOpen(false)
    }
  }

  // Handle option selection
  // FIX: Use selectedRef.current to always get the latest selected value
  // This prevents stale closure issue when user clicks rapidly
  const handleOptionClick = useCallback((option: string) => {
    const currentSelected = selectedRef.current
    const newSelected = currentSelected.includes(option)
      ? currentSelected.filter(item => item !== option)
      : [...currentSelected, option]
    
    onChange(newSelected)
  }, [onChange])

  // Handle clear all
  const handleClearAll = () => {
    onChange([])
    setSearchTerm("")
  }

  // Handle click outside
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (
        containerRef.current && 
        !containerRef.current.contains(target) &&
        menuRef.current && 
        !menuRef.current.contains(target)
      ) {
        setOpen(false)
        setSearchTerm("") // Clear search when closing
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  // Client-side only
  useEffect(() => {
    setIsMounted(true)
  }, [])

  // Filter options based on search term
  const filteredOptions = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    return term
      ? options.filter(opt => opt.toLowerCase().includes(term))
      : options
  }, [options, searchTerm])

  // Display label: static (always placeholder) or dynamic (selection/count)
  const label = staticLabel
    ? placeholder
    : selected.length === 0
      ? placeholder
      : selected.length === 1
        ? selected[0]
        : `${selected.length} selected`
  
  // Determine button width based on placeholder
  const getButtonWidth = () => {
    if (width !== "auto") return width;
    
    // Compact widths based on placeholder
    switch (placeholder) {
      case "Vendor": return "w-[100px]";
      case "Program": return "w-[110px]";
      case "City (imp_ttp)": return "w-[120px]";
      case "RAN Score": return "w-[110px]";
      default: return "w-[110px]";
    }
  }

  // Menu component
  const Menu = () => (
    <div
      ref={menuRef}
      className={`fixed z-[9999] max-h-60 overflow-auto rounded-lg border border-white/10 bg-[#0F1630] p-2 shadow-lg min-w-0 ${menuPosition.alignRight ? 'origin-top-right' : 'origin-top-left'}`}
      style={{ 
        top: `${menuPosition.top}px`, 
        left: `${menuPosition.left}px`, 
        minWidth: `${menuPosition.width}px` 
      }}
      onMouseDown={(e) => e.preventDefault()}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="responsive-text-sm uppercase tracking-wider text-gray-400 px-1">Options</div>
        {selected.length > 0 && (
          <button 
            onClick={(e) => {
              e.stopPropagation()
              handleClearAll()
            }}
            onMouseDown={(e) => e.preventDefault()}
            className="responsive-text-sm text-gray-400 hover:text-white flex items-center gap-0.5"
          >
            Clear <X className="h-2.5 w-2.5" />
          </button>
        )}
      </div>
      
      {/* Search input */}
      <div className="mb-1.5 px-1">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onMouseDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          placeholder="Search..."
          className="w-full bg-white/5 rounded responsive-text-sm px-2 py-1 text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-white/20"
          autoFocus
        />
      </div>
      
      {filteredOptions.length === 0 ? (
        <div className="px-2 py-1 responsive-text-sm text-gray-400">No options found</div>
      ) : (
        <div>
          {filteredOptions.map(option => (
            <button 
              key={option} 
              type="button"
              className="w-full text-left flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/5 cursor-pointer select-none min-w-0"
              onClick={(e) => {
                e.stopPropagation()
                handleOptionClick(option)
              }}
              onMouseDown={(e) => e.preventDefault()}
            >
              <div className="flex-shrink-0 w-3.5 h-3.5 border rounded flex items-center justify-center border-white/20">
                {selected.includes(option) && <Check className="h-2.5 w-2.5 text-blue-500" />}
              </div>
              <span className="responsive-text-sm text-white truncate">{option}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )


  return (
    <div ref={containerRef} className={`relative min-w-0 ${className}`}>
      <button
        ref={buttonRef}
        type="button"
        className={`bg-white/5 rounded-md h-6 px-1.5 inline-flex items-center justify-between text-white min-w-0 ${getButtonWidth()}`}
        onClick={handleToggle}
        disabled={disabled}
      >
        <span className="truncate min-w-0 text-xs text-left">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-70 flex-shrink-0" />
      </button>

      {open && isMounted && createPortal(<Menu />, document.body)}
    </div>
  )
} 
