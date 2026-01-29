import { NextResponse } from 'next/server'

/** @deprecated Use hermesAggregated from useHermes5GDataOptimized (byNanoCluster) instead. */
export async function GET() {
  return NextResponse.json(
    {
      status: 'deprecated',
      message: 'Use hermesAggregated.byNanoCluster from useHermes5GDataOptimized instead.',
      migrated: 'hermesAggregated'
    },
    { status: 410 }
  )
}
