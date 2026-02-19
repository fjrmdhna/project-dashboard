import { NextRequest, NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const AOP_PAYLOAD_KEYS = [
  'q',
  'vendor_name',
  'program_report',
  'circle',
  'site_category',
  'pm_indosat',
  'wbs_status',
  'year',
  'priority_congest_urgent',
  'trial_gb_factory'
] as const

const MAX_NAME_LENGTH = 100
const MAX_PAYLOAD_SIZE = 50_000

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

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'Template ID is required' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const rawPayload = body?.payload
    const name = typeof body?.name === 'string' ? body.name.trim() : undefined

    const updates: { payload?: Record<string, unknown>; name?: string } = {}
    if (rawPayload !== undefined) {
      updates.payload = normalizePayload(rawPayload)
      const payloadStr = JSON.stringify(updates.payload)
      if (payloadStr.length > MAX_PAYLOAD_SIZE) {
        return NextResponse.json(
          { status: 'error', message: 'Template payload too large' },
          { status: 400 }
        )
      }
    }
    if (name !== undefined) {
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
      updates.name = name
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { status: 'error', message: 'No updates provided (payload or name)' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('aop_filter_templates')
      .update(updates)
      .eq('id', id)
      .select('id,name,payload,created_at,updated_at')
      .single()

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { status: 'error', message: 'Template not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { status: 'error', message: error.message || 'Failed to update template' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      status: 'success',
      data: data ?? {}
    })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to update template' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params
    if (!id) {
      return NextResponse.json(
        { status: 'error', message: 'Template ID is required' },
        { status: 400 }
      )
    }

    const { error } = await supabase
      .from('aop_filter_templates')
      .delete()
      .eq('id', id)

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json(
          { status: 'error', message: 'Template not found' },
          { status: 404 }
        )
      }
      return NextResponse.json(
        { status: 'error', message: error.message || 'Failed to delete template' },
        { status: 500 }
      )
    }

    return NextResponse.json({ status: 'success' })
  } catch (err) {
    return NextResponse.json(
      { status: 'error', message: 'Failed to delete template' },
      { status: 500 }
    )
  }
}
