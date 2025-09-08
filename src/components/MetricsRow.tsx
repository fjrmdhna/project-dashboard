"use client"

import { memo } from 'react'
import { 
  ClipboardCheck, 
  Eye, 
  Server, 
  Signal, 
  Zap, 
  Radio, 
  Bell, 
  ThumbsUp,
  TrendingUp 
} from 'lucide-react'

interface StatsData {
  total: number
  scope: number
  caf: number
  mos: number
  installation: number
  fiveGReadiness: number
  fiveGActivation: number
  rfc: number
  endorse: number
  hotnews: number
  pac: number
  clusterAtp: number
}

interface MetricsRowProps {
  stats: StatsData | null
  loading?: boolean
}

const MetricsRow = memo(function MetricsRow({ stats, loading = false }: MetricsRowProps) {
  
  const metrics = [
    {
      key: 'caf',
      label: 'CAF',
      value: stats?.caf || 0,
      icon: ClipboardCheck,
      color: 'text-blue-400'
    },
    {
      key: 'mos',
      label: 'MOS', 
      value: stats?.mos || 0,
      icon: Eye,
      color: 'text-green-400'
    },
    {
      key: 'installation',
      label: 'INSTALL',
      value: stats?.installation || 0,
      icon: Server,
      color: 'text-purple-400'
    },
    {
      key: 'fiveGReadiness',
      label: 'READINESS',
      value: stats?.fiveGReadiness || 0,
      icon: Signal,
      color: 'text-orange-400'
    },
    {
      key: 'fiveGActivation',
      label: 'ACTIVATED',
      value: stats?.fiveGActivation || 0,
      icon: Zap,
      color: 'text-yellow-400'
    },
    {
      key: 'clusterAtp',
      label: 'PATP',
      value: stats?.clusterAtp || 0,
      icon: Radio,
      color: 'text-indigo-400'
    },
    {
      key: 'hotnews',
      label: 'HOT NEWS',
      value: stats?.hotnews || 0,
      icon: Bell,
      color: 'text-red-400'
    },
    {
      key: 'endorse',
      label: 'ENDORSE',
      value: stats?.endorse || 0,
      icon: ThumbsUp,
      color: 'text-emerald-400'
    }
  ]

  if (loading) {
    return (
      <div className="bg-slate-800 rounded-lg p-4 mb-6">
        <div className="flex justify-center items-center h-20">
          <div className="flex items-center space-x-3">
            <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin"></div>
            <span className="text-gray-400">Loading metrics...</span>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-slate-800 rounded-lg p-2 mb-2">
      {/* Total Sites Header */}
      <div className="flex items-center justify-center mb-2">
        <div className="flex items-center space-x-2">
          <div className="w-6 h-6 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center">
            <TrendingUp className="h-3 w-3 text-white" />
          </div>
          <div className="text-center">
            <div className="text-xl font-bold text-blue-300">{stats?.total || 0}</div>
            <div className="text-gray-400 text-[10px]">Total Sites</div>
          </div>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-8 gap-1">
        {metrics.map((metric) => {
          const IconComponent = metric.icon
          
          return (
            <div key={metric.key} className="text-center bg-slate-700 rounded-lg p-1 hover:bg-slate-600 transition-colors">
              <div className="flex items-center justify-center mb-1">
                <IconComponent className={`h-2 w-2 ${metric.color}`} />
              </div>
              <div className="text-sm font-bold text-white mb-1">
                {metric.value.toLocaleString()}
              </div>
              <div className="text-[8px] text-gray-400 font-medium">
                {metric.label}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
})

export { MetricsRow } 