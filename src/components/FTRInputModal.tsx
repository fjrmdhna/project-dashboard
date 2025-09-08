"use client"

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { 
  Percent, 
  Save, 
  X, 
  AlertCircle, 
  CheckCircle,
  Edit3
} from "lucide-react"
import { FTRInputData } from '@/types/leaderboard'
import { getCurrentWeek } from '@/lib/leaderboard-utils'

interface FTRInputModalProps {
  isOpen: boolean
  onClose: () => void
  vendors: string[]
  currentWeek?: number
  currentYear?: number
  onSave: (data: FTRInputData[]) => void
  existingData?: FTRInputData[]
}

export function FTRInputModal({
  isOpen,
  onClose,
  vendors,
  currentWeek,
  currentYear,
  onSave,
  existingData = []
}: FTRInputModalProps) {
  const { week, year } = getCurrentWeek()
  const activeWeek = currentWeek || week
  const activeYear = currentYear || year

  // Initialize FTR data for all vendors
  const [ftrData, setFtrData] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {}
    vendors.forEach(vendor => {
      const existing = existingData.find(
        data => data.vendor_name === vendor && 
                data.week_number === activeWeek && 
                data.year === activeYear
      )
      initial[vendor] = existing?.ftr_percentage || 0
    })
    return initial
  })

  const [notes, setNotes] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {}
    vendors.forEach(vendor => {
      const existing = existingData.find(
        data => data.vendor_name === vendor && 
                data.week_number === activeWeek && 
                data.year === activeYear
      )
      initial[vendor] = existing?.notes || ''
    })
    return initial
  })

  const [isSaving, setIsSaving] = useState(false)
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({})

  // Handle FTR percentage change
  const handleFTRChange = (vendor: string, value: string) => {
    const numValue = parseFloat(value)
    
    // Validation
    const errors = { ...validationErrors }
    if (isNaN(numValue) || numValue < 0 || numValue > 100) {
      errors[vendor] = 'FTR harus antara 0-100%'
    } else {
      delete errors[vendor]
    }
    
    setValidationErrors(errors)
    setFtrData(prev => ({ ...prev, [vendor]: numValue || 0 }))
  }

  // Handle notes change
  const handleNotesChange = (vendor: string, value: string) => {
    setNotes(prev => ({ ...prev, [vendor]: value }))
  }

  // Validate all inputs
  const validateInputs = (): boolean => {
    const errors: Record<string, string> = {}
    
    vendors.forEach(vendor => {
      const value = ftrData[vendor]
      if (isNaN(value) || value < 0 || value > 100) {
        errors[vendor] = 'FTR harus antara 0-100%'
      }
    })
    
    setValidationErrors(errors)
    return Object.keys(errors).length === 0
  }

  // Handle save
  const handleSave = async () => {
    if (!validateInputs()) return

    setIsSaving(true)
    
    try {
      const saveData: FTRInputData[] = vendors.map(vendor => ({
        vendor_name: vendor,
        week_number: activeWeek,
        year: activeYear,
        ftr_percentage: ftrData[vendor],
        notes: notes[vendor],
        updated_by: 'current_user', // TODO: Get from auth context
        updated_at: new Date().toISOString()
      }))

      await onSave(saveData)
      onClose()
    } catch (error) {
      console.error('Error saving FTR data:', error)
    } finally {
      setIsSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
      <div className="bg-background rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b bg-muted/50">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Edit3 className="h-5 w-5" />
                Input FTR (First Time Right)
              </h2>
              <p className="text-sm text-muted-foreground">
                Week {activeWeek}, {activeYear} • Input persentase FTR untuk setiap vendor
              </p>
            </div>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          <div className="space-y-4">
            {vendors.map((vendor) => {
              const hasError = validationErrors[vendor]
              const currentValue = ftrData[vendor]
              
              return (
                <Card key={vendor} className={`${hasError ? 'border-red-500' : ''}`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">{vendor}</CardTitle>
                      <Badge variant={currentValue > 0 ? "default" : "outline"}>
                        {currentValue.toFixed(1)}%
                      </Badge>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="space-y-4">
                    {/* FTR Percentage Input */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        FTR Percentage (0-100%)
                      </label>
                      <div className="relative mt-1">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={currentValue || ''}
                          onChange={(e) => handleFTRChange(vendor, e.target.value)}
                          className={`w-full px-3 py-2 pr-10 border rounded-md bg-background ${
                            hasError 
                              ? 'border-red-500 focus:border-red-500' 
                              : 'border-input focus:border-primary'
                          }`}
                          placeholder="0.0"
                        />
                        <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      </div>
                      {hasError && (
                        <div className="flex items-center gap-1 mt-1 text-red-600 text-sm">
                          <AlertCircle className="h-3 w-3" />
                          {hasError}
                        </div>
                      )}
                    </div>

                    {/* Notes Input */}
                    <div>
                      <label className="text-sm font-medium text-muted-foreground">
                        Notes (Optional)
                      </label>
                      <textarea
                        value={notes[vendor] || ''}
                        onChange={(e) => handleNotesChange(vendor, e.target.value)}
                        className="w-full px-3 py-2 mt-1 border border-input rounded-md bg-background resize-none"
                        rows={2}
                        placeholder="Catatan tambahan untuk FTR minggu ini..."
                      />
                    </div>

                    {/* Score Preview */}
                    <div className="bg-muted p-3 rounded-lg">
                      <div className="text-sm font-medium text-muted-foreground">Score Preview:</div>
                      <div className="text-lg font-bold">
                        {(currentValue * 0.15).toFixed(2)} points
                        <span className="text-sm font-normal text-muted-foreground ml-2">
                          (FTR × 15%)
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-muted/50">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {Object.keys(validationErrors).length === 0 ? (
                <div className="flex items-center gap-1 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Semua input valid
                </div>
              ) : (
                <div className="flex items-center gap-1 text-red-600">
                  <AlertCircle className="h-4 w-4" />
                  {Object.keys(validationErrors).length} input memiliki error
                </div>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <Button variant="outline" onClick={onClose} disabled={isSaving}>
                Cancel
              </Button>
              <Button 
                onClick={handleSave} 
                disabled={Object.keys(validationErrors).length > 0 || isSaving}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4 mr-2" />
                    Save FTR Data
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
} 