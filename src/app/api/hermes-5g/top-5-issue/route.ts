import { NextResponse } from 'next/server'

/** @deprecated Use hermesAggregated from useHermes5GDataOptimized (topIssues) instead. */
export async function GET() {
  return NextResponse.json(
    {
      status: 'deprecated',
      message: 'Use hermesAggregated.topIssues from useHermes5GDataOptimized instead.',
      migrated: 'hermesAggregated'
    },
    { status: 410 }
  )
}
