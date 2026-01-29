import { NextResponse } from 'next/server'

/** @deprecated Use hermesAggregated / filtered data from useHermes5GDataOptimized instead. */
export async function GET() {
  return NextResponse.json(
    {
      status: 'deprecated',
      message: 'Use useHermes5GDataOptimized filtered data for alignment metrics instead.',
      migrated: 'hermesAggregated'
    },
    { status: 410 }
  )
}
