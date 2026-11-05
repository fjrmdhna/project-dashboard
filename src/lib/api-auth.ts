import { NextResponse } from 'next/server'

function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}

function readProvidedApiKey(request: Request): string | null {
  const headerApiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key')
  const url = new URL(request.url)
  const queryApiKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key')
  return headerApiKey || queryApiKey || null
}

/**
 * Validate API key against one or more env var names (first non-empty wins).
 * Production: fail-closed if no env key is configured.
 * Development: warn and allow if no env key (local convenience only).
 */
export function validateApiKey(
  request: Request,
  envVarNames: string | string[] = ['TLP_API_KEY', 'API_KEY']
): { valid: boolean; error?: string } {
  const names = Array.isArray(envVarNames) ? envVarNames : [envVarNames]
  const validApiKey = names.map((name) => process.env[name]).find((value) => Boolean(value?.trim()))

  if (!validApiKey) {
    if (isProduction()) {
      return {
        valid: false,
        error: `API key not configured on server (${names.join(' / ')}).`,
      }
    }
    console.warn(
      `[api-auth] No API key env configured (${names.join(', ')}). Allowing access in non-production.`
    )
    return { valid: true }
  }

  const providedApiKey = readProvidedApiKey(request)

  if (!providedApiKey) {
    return {
      valid: false,
      error: 'API key is required. Provide it via X-API-Key header or apiKey query parameter.',
    }
  }

  if (providedApiKey !== validApiKey) {
    return {
      valid: false,
      error: 'Invalid API key.',
    }
  }

  return { valid: true }
}

/**
 * Return 401 JSON response when API key is invalid; otherwise null.
 */
export function requireApiKey(
  request: Request,
  envVarNames: string | string[] = ['TLP_API_KEY', 'API_KEY']
): NextResponse | null {
  const validation = validateApiKey(request, envVarNames)

  if (!validation.valid) {
    return NextResponse.json(
      {
        status: 'error',
        success: false,
        message: 'Unauthorized',
        error: validation.error,
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    )
  }

  return null
}
