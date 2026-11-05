import { NextResponse } from 'next/server'
import { getServerSupabase } from '@/lib/server-supabase'
import { memoryGet, memorySet } from '@/lib/memory-cache'
import {
  STALE_AFTER_MINUTES,
  type SanitationApiResponse,
  type SanitationSnapshot,
} from '@/lib/sanitation-report/types'

export const dynamic = 'force-dynamic'

const CACHE_KEY = 'sanitation-report:latest'
const CACHE_TTL_SECONDS = 60

export async function GET(req: Request) {
  try {
    const fresh = new URL(req.url).searchParams.has('fresh')
    let snapshot = fresh ? null : memoryGet<SanitationSnapshot>(CACHE_KEY)
    if (!snapshot) {
      const { data, error } = await getServerSupabase()
        .from('sanitation_report_snapshots')
        .select('payload')
        .eq('id', 'latest')
        .maybeSingle()
      if (error) throw new Error(error.message)
      const payload = data?.payload as SanitationSnapshot | undefined
      if (payload && payload.version !== 2) throw new Error('Snapshot versi lama; jalankan collector v2')
      snapshot = payload ?? null
      if (snapshot) memorySet(CACHE_KEY, snapshot, CACHE_TTL_SECONDS)
    }

    const ageMinutes = snapshot
      ? Math.max(0, Math.round((Date.now() - new Date(snapshot.generatedAt).getTime()) / 60000))
      : null
    const body: SanitationApiResponse = {
      snapshot,
      ageMinutes,
      stale: ageMinutes === null || ageMinutes > STALE_AFTER_MINUTES,
    }
    return NextResponse.json(body)
  } catch (e) {
    const body: SanitationApiResponse = {
      snapshot: null,
      stale: true,
      ageMinutes: null,
      error: e instanceof Error ? e.message : 'Unknown error',
    }
    return NextResponse.json(body, { status: 500 })
  }
}

