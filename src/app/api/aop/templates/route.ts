import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const AOP_PAYLOAD_KEYS = [
  'q',
  'vendor_name',
  'program_report',
  'circle',
  'site_category',
  'ran_score',
  'year',
  'priority_congest_urgent',
  'trial_gb_factory'
] as const

const MAX_NAME_LENGTH = 100
const MAX_PAYLOAD_SIZE = 50_000 // bytes approx

function normalizePayload(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return {}
  }
  const out: Record<string, unknown> = {}
  const obj = raw as Record<string, unknown>
  for (const key of AOP_PAYLOAD_KEYS) {
    const v = obj[key]
    if (key === 'q') {
      out[key] = typeof v === 'string' ? v : ''
    } else {
      out[key] = Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []
    }
  }
  return out
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') || '50', 10)), 100)

    const { data, error } = await supabase
      .from('aop_filter_templates')
      .select('id,name,payload,created_at')
      .order('updated_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[AOP Templates API] GET error:', error)
      return NextResponse.json(
        { status: 'error', message: error.message || 'Failed to fetch templates' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'success',
      data: data ?? []
    }, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' }
    })
  } catch (err) {
    console.error('[AOP Templates API] GET exception:', err)
    return NextResponse.json(
      { status: 'error', message: 'Failed to fetch templates' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const name = typeof body?.name === 'string' ? body.name.trim() : ''
    const rawPayload = body?.payload

    if (!name) {
      return NextResponse.json(
        { status: 'error', message: 'Template name is required' },
        { status: 400 }
      )
    }
    if (name.length > MAX_NAME_LENGTH) {
      return NextResponse.json(
        { status: 'error', message: `Template name must be at most ${MAX_NAME_LENGTH} characters` },
        { status: 400 }
      )
    }

    const payload = normalizePayload(rawPayload)
    const payloadStr = JSON.stringify(payload)
    if (payloadStr.length > MAX_PAYLOAD_SIZE) {
      return NextResponse.json(
        { status: 'error', message: 'Template payload too large' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('aop_filter_templates')
      .insert({ name, payload })
      .select('id,name,payload,created_at,updated_at')
      .single()

    if (error) {
      console.error('[AOP Templates API] POST error:', error)
      return NextResponse.json(
        { status: 'error', message: error.message || 'Failed to save template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'success',
      data: data ?? { id: '', name, payload, created_at: '', updated_at: '' }
    }, { status: 201 })
  } catch (err) {
    console.error('[AOP Templates API] POST exception:', err)
    return NextResponse.json(
      { status: 'error', message: 'Failed to save template' },
      { status: 500 }
    )
  }
}
