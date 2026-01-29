import { NextResponse } from 'next/server'

/** @deprecated Use hermesAggregated from useHermes5GDataOptimized (byCity) instead. */
export async function GET() {
  return NextResponse.json(
    {
      status: 'deprecated',
      message: 'Use hermesAggregated.byCity from useHermes5GDataOptimized instead.',
      migrated: 'hermesAggregated'
    },
    { status: 410 }
  )
}
