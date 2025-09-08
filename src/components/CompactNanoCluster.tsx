"use client"

import { memo } from 'react'
import { Server } from 'lucide-react'
import { CompactChart } from './CompactChart'

interface NanoClusterData {
  cluster_id: string
  cluster_name: string
  status: string
  total_sites: number
  completed_sites: number
  percentage: number
}

interface CompactNanoClusterProps {
  data: NanoClusterData | null
}

const CompactNanoCluster = memo(function CompactNanoCluster({ data }: CompactNanoClusterProps) {
  if (!data) {
    return (
      <CompactChart
        title="NANO CLUSTER"
        icon={<Server className="h-3 w-3 text-green-400" />}
        loading={true}
      >
        <div></div>
      </CompactChart>
    )
  }

  const clusters = [
    { name: 'Red', count: 398, color: '#EF4444' },
    { name: 'Orange', count: 20, color: '#F97316' },
    { name: 'Blue', count: 24, color: '#3B82F6' },
    { name: 'Green', count: 41, color: '#10B981' }
  ]

  const total = clusters.reduce((sum, cluster) => sum + cluster.count, 0)

  return (
    <CompactChart
      title="NANO CLUSTER"
      icon={<Server className="h-3 w-3 text-green-400" />}
    >
      <div className="flex flex-col h-full overflow-hidden">
        {/* Total */}
        <div className="text-center mb-1 flex-shrink-0">
          <div className="text-xl font-bold text-white">{total}</div>
          <div className="text-[8px] text-gray-400">Total Nano Cluster</div>
        </div>
        
        {/* Cluster Grid */}
        <div className="grid grid-cols-2 gap-1 flex-1 min-h-0">
          {clusters.map((cluster) => (
            <div key={cluster.name} className="text-center bg-slate-700 rounded p-1 overflow-hidden">
              <div 
                className="w-3 h-3 rounded-full mx-auto mb-1"
                style={{ backgroundColor: cluster.color }}
              />
              <div className="text-sm font-bold text-white truncate">
                {cluster.count}
              </div>
              <div className="text-[7px] text-gray-400 truncate">
                Cluster
              </div>
            </div>
          ))}
        </div>
      </div>
    </CompactChart>
  )
})

export { CompactNanoCluster } 