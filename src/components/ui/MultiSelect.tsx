"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { createPortal } from "react-dom"
import { Check, ChevronDown, X } from "lucide-react"

export interface MultiSelectProps {
  options: string[]
  selected: string[]
  placeholder?: string
  onChange: (selected: string[]) => void
  className?: string
  disabled?: boolean
  width?: string
}

export function MultiSelect({
  options,
  selected,
  placeholder = "Select",
  onChange,
  className = "",
  disabled = false,
  width = "auto"
}: MultiSelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const [menuPosition, setMenuPosition] = useState({ top: 0, left: 0, width: 0 })
  const [isMounted, setIsMounted] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Update menu position when button is clicked
  const updateMenuPosition = () => {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setMenuPosition({
      top: rect.bottom + window.scrollY + 4,
      left: rect.left + window.scrollX,
      width: Math.max(180, rect.width)
    })
  }

  // Handle toggle dropdown
  const handleToggle = () => {
    if (!disabled) {
      if (!open) {
        updateMenuPosition()
      }
      setOpen(!open)
    }
  }

  // Handle option selection
  const handleOptionClick = useCallback((option: string) => {
    const newSelected = selected.includes(option)
      ? selected.filter(item => item !== option)
      : [...selected, option]
    
    console.log('MultiSelect option clicked:', option, 'New selection:', newSelected)
    onChange(newSelected)
  }, [selected, onChange])

  // Handle clear all
  const handleClearAll = () => {
    onChange([])
    setSearchTerm("")
  }

  // Handle click outside
  useEffect(() => {
    if (!open) return

    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current && 
        !containerRef.current.contains(event.target as Node) &&
        menuRef.current && 
        !menuRef.current.contains(event.target as Node)
      ) {
        setOpen(false)
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
  const filteredOptions = searchTerm 
    ? options.filter(opt => opt.toLowerCase().includes(searchTerm.toLowerCase()))
    : options

  // Display label
  const label = selected.length === 0 
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
      default: return "w-[110px]";
    }
  }

  // Menu component
  const Menu = () => (
    <div
      ref={menuRef}
      className="fixed z-[9999] max-h-60 overflow-auto rounded-lg border border-white/10 bg-[#0F1630] p-2 shadow-lg min-w-0"
      style={{ 
        top: `${menuPosition.top}px`, 
        left: `${menuPosition.left}px`, 
        minWidth: `${menuPosition.width}px` 
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="responsive-text-sm uppercase tracking-wider text-gray-400 px-1">Options</div>
        {selected.length > 0 && (
          <button 
            onClick={handleClearAll}
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
          placeholder="Search..."
          className="w-full bg-white/5 rounded responsive-text-sm px-2 py-1 text-white placeholder:text-gray-500 outline-none focus:ring-1 focus:ring-white/20"
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
              onClick={() => handleOptionClick(option)}
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
        <span className="truncate max-w-[80px] text-xs text-left">{label}</span>
        <ChevronDown className="h-3 w-3 opacity-70 flex-shrink-0" />
      </button>

      {open && isMounted && createPortal(<Menu />, document.body)}
    </div>
  )
} 