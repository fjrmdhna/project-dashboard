"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Filter, Eye, EyeOff, RotateCcw } from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

interface Column {
  key: string
  label: string
  visible: boolean
  essential?: boolean // Cannot be hidden
}

interface ColumnManagerProps {
  columns: Column[]
  visibleColumns: Set<string>
  onToggleColumn: (key: string) => void
  onResetColumns: () => void
}

export function ColumnManager({
  columns,
  visibleColumns,
  onToggleColumn,
  onResetColumns
}: ColumnManagerProps) {
  const [isOpen, setIsOpen] = useState(false)
  
  const visibleCount = columns.filter(col => visibleColumns.has(col.key)).length
  const totalCount = columns.length
  
  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="h-4 w-4 mr-2" />
          Columns ({visibleCount}/{totalCount})
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel className="flex items-center justify-between">
          <span>Manage Columns</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={onResetColumns}
            className="h-auto p-1"
          >
            <RotateCcw className="h-3 w-3" />
          </Button>
        </DropdownMenuLabel>
        
        <DropdownMenuSeparator />
        
        <div className="max-h-64 overflow-y-auto">
          {columns.map((column) => {
            const isVisible = visibleColumns.has(column.key)
            const isEssential = column.essential
            
            return (
              <DropdownMenuItem
                key={column.key}
                className="flex items-center justify-between cursor-pointer"
                onClick={(e) => {
                  e.preventDefault()
                  if (!isEssential) {
                    onToggleColumn(column.key)
                  }
                }}
                disabled={isEssential}
              >
                <span className={`text-sm ${isEssential ? 'text-muted-foreground' : ''}`}>
                  {column.label}
                  {isEssential && <span className="text-xs ml-1">(Required)</span>}
                </span>
                
                <div className="flex items-center">
                  {isVisible ? (
                    <Eye className="h-4 w-4 text-green-600" />
                  ) : (
                    <EyeOff className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              </DropdownMenuItem>
            )
          })}
        </div>
        
        <DropdownMenuSeparator />
        
        <div className="p-2 text-xs text-muted-foreground text-center">
          {visibleCount} of {totalCount} columns visible
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
} 