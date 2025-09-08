"use client"

import { memo } from 'react'
import { AlertTriangle } from 'lucide-react'
import { CompactChart } from './CompactChart'

interface Top5IssueData {
  issue: string
  count: number
  percentage: number
}

interface CompactTop5IssuesProps {
  data: Top5IssueData[]
  top5Count: number
  totalCount: number
}

const CompactTop5Issues = memo(function CompactTop5Issues({ 
  data, 
  top5Count, 
  totalCount 
}: CompactTop5IssuesProps) {
  if (!data || data.length === 0) {
    return (
      <CompactChart
        title="TOP 5 ISSUES"
        icon={<AlertTriangle className="h-3 w-3 text-red-400" />}
        loading={true}
      >
        <div></div>
      </CompactChart>
    )
  }

  const topIssues = data.slice(0, 5)

  return (
    <CompactChart
      title="TOP 5 ISSUES"
      icon={<AlertTriangle className="h-3 w-3 text-red-400" />}
    >
      <div className="p-2 h-full flex flex-col overflow-hidden">
        {/* Issues List */}
        <div className="flex-1 space-y-1 overflow-hidden min-h-0">
          {topIssues.map((issue, index) => (
            <div key={index} className="flex items-center justify-between text-[8px] py-0.5 overflow-hidden">
              <div className="flex items-center space-x-1 flex-1 min-w-0 pr-1 overflow-hidden">
                <div className="w-1 h-1 bg-red-400 rounded-full flex-shrink-0"></div>
                <span 
                  className="text-gray-300 truncate font-medium"
                  title={issue.issue || 'Unknown Issue'}
                >
                  {issue.issue?.substring(0, 15) || 'Unknown Issue'}
                </span>
              </div>
              <div className="text-white font-bold text-[9px] flex-shrink-0 ml-1 min-w-[20px] text-right">
                {issue.count}
              </div>
            </div>
          ))}
          
          {/* Fill empty slots if less than 5 issues */}
          {Array.from({ length: Math.max(0, 5 - topIssues.length) }).map((_, index) => (
            <div key={`empty-${index}`} className="flex items-center text-[8px] py-0.5 opacity-30 overflow-hidden">
              <div className="flex items-center space-x-1 flex-1 overflow-hidden">
                <div className="w-1 h-1 bg-gray-600 rounded-full"></div>
                <span className="text-gray-500 truncate">No more issues</span>
              </div>
            </div>
          ))}
        </div>
        
        {/* Summary */}
        <div className="text-center mt-1 pt-1 border-t border-slate-700 flex-shrink-0">
          <div className="text-lg font-bold text-red-400 leading-tight">{top5Count}</div>
          <div className="text-[8px] text-gray-400 font-medium">Total Issues</div>
        </div>
      </div>
    </CompactChart>
  )
})

export { CompactTop5Issues } 