"use client"
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { BarChart3, Network, Hourglass, Target } from 'lucide-react'

interface NanoClusterData {
  totalClusters: number
  readinessLess50: number
  readiness50to80: number
  readiness80to99: number
  readiness100: number
  completed: number
}

interface NanoClusterProps {
  data: NanoClusterData
}

export function NanoClusterChart({ data }: NanoClusterProps) {
  return (
    <Card className="bg-gradient-to-r from-slate-800 to-slate-900 border-slate-700">
      <CardHeader className="pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
              <BarChart3 className="h-6 w-6 text-white" />
            </div>
            <div>
              <CardTitle className="text-2xl font-bold text-white">NANO CLUSTER</CardTitle>
              <p className="text-gray-400 text-sm">Cluster readiness and completion status</p>
            </div>
          </div>
          
          {/* Total Nano Cluster */}
          <div className="text-right">
            <div className="flex items-center space-x-2 mb-2">
              <Network className="h-6 w-6 text-white" />
            </div>
            <div className="text-3xl font-bold text-white">{data.totalClusters}</div>
            <div className="text-sm text-gray-400">Total Nano Cluster</div>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Cluster Readiness Metrics */}
        <div className="grid grid-cols-4 gap-4">
          {/* Cluster Readiness <50% */}
          <div className="text-center bg-slate-700 rounded-lg p-4 border-l-4 border-red-500">
            <div className="flex justify-center mb-2">
              <Hourglass className="h-6 w-6 text-red-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.readinessLess50}</div>
            <div className="text-xs text-gray-400 leading-tight">Cluster Readiness &lt;50%</div>
          </div>

          {/* Cluster Readiness 50-80% */}
          <div className="text-center bg-slate-700 rounded-lg p-4 border-l-4 border-yellow-500">
            <div className="flex justify-center mb-2">
              <Hourglass className="h-6 w-6 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.readiness50to80}</div>
            <div className="text-xs text-gray-400 leading-tight">Cluster Readiness 50-80%</div>
          </div>

          {/* Cluster Readiness 80-99% */}
          <div className="text-center bg-slate-700 rounded-lg p-4 border-l-4 border-blue-500">
            <div className="flex justify-center mb-2">
              <Hourglass className="h-6 w-6 text-blue-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.readiness80to99}</div>
            <div className="text-xs text-gray-400 leading-tight">Cluster Readiness 80-99%</div>
          </div>

          {/* Cluster Readiness 100% */}
          <div className="text-center bg-slate-700 rounded-lg p-4 border-l-4 border-green-500">
            <div className="flex justify-center mb-2">
              <Hourglass className="h-6 w-6 text-green-400" />
            </div>
            <div className="text-2xl font-bold text-white">{data.readiness100}</div>
            <div className="text-xs text-gray-400 leading-tight">Cluster Readiness 100%</div>
          </div>
        </div>

        {/* Completion Status */}
        <div className="bg-slate-700 rounded-lg p-6">
          <div className="flex items-center justify-center space-x-4">
            <div className="flex items-center space-x-3">
              <Target className="h-8 w-8 text-green-400" />
              <div className="text-center">
                <div className="text-4xl font-bold text-white">{data.completed}</div>
                <div className="text-sm text-gray-400">Cluster Completed (100% 5G Activated)</div>
              </div>
            </div>
          </div>
        </div>

        {/* Summary Stats */}
        <div className="pt-4">
          <div className="bg-slate-700 rounded-lg p-4 max-w-xs mx-auto">
            <div className="text-center">
              <div className="text-lg font-medium text-gray-400 mb-1">Completion Rate</div>
              <div className="text-2xl font-bold text-white">
                {data.totalClusters > 0 ? ((data.completed / data.totalClusters) * 100).toFixed(1) : '0'}%
              </div>
              <div className="text-xs text-gray-500">
                {data.completed} of {data.totalClusters} clusters
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
} 