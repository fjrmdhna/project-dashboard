"use client"

import { memo } from 'react'
import { Database } from 'lucide-react'
import { CompactChart } from './CompactChart'

interface DataAlignmentData {
  totalSites: number
  alignedSites: number
  misalignedSites: number
  alignmentRate: number
  lastUpdated: string
  regions?: {
    [key: string]: {
      aligned: number
      misaligned: number
    }
  }
}

interface CompactDataAlignmentProps {
  data: DataAlignmentData | null
}

const CompactDataAlignment = memo(function CompactDataAlignment({ data }: CompactDataAlignmentProps) {
  if (!data) {
    return (
      <CompactChart
        title="DATA ALIGNMENT"
        icon={<Database className="h-3 w-3 text-blue-400" />}
        loading={true}
      >
        <div></div>
      </CompactChart>
    )
  }

  const alignmentPercentage = data.alignmentRate || 0
  const misalignmentPercentage = 100 - alignmentPercentage

  return (
    <CompactChart
      title="DATA ALIGNMENT"
      icon={<Database className="h-3 w-3 text-blue-400" />}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Alignment Rate */}
        <div className="text-center mb-1 flex-shrink-0">
          <div className="text-xl font-bold text-green-400">
            {alignmentPercentage.toFixed(1)}%
          </div>
          <div className="text-[8px] text-gray-400">Aligned</div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-1 flex-shrink-0">
          <div className="w-full bg-slate-700 rounded-full h-1.5">
            <div 
              className="bg-green-400 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${alignmentPercentage}%` }}
            />
          </div>
        </div>
        
        {/* Stats */}
        <div className="grid grid-cols-3 gap-1 text-center flex-1 min-h-0">
          <div className="bg-slate-700 rounded p-1 overflow-hidden">
            <div className="text-xs font-bold text-white truncate">{data.totalSites}</div>
            <div className="text-[6px] text-gray-400">Total</div>
          </div>
          <div className="bg-slate-700 rounded p-1 overflow-hidden">
            <div className="text-xs font-bold text-green-400 truncate">{data.alignedSites}</div>
            <div className="text-[6px] text-gray-400">Aligned</div>
          </div>
          <div className="bg-slate-700 rounded p-1 overflow-hidden">
            <div className="text-xs font-bold text-red-400 truncate">{data.misalignedSites}</div>
            <div className="text-[6px] text-gray-400">Misaligned</div>
          </div>
        </div>
      </div>
    </CompactChart>
  )
})

export { CompactDataAlignment } 