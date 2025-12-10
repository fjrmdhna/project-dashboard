import { NextResponse } from 'next/server'

/**
 * Validate API Key from request
 * Supports both header (X-API-Key) and query parameter (apiKey)
 */
export function validateApiKey(request: Request): { valid: boolean; error?: string } {
  // Get API key from environment variable
  const validApiKey = process.env.TLP_API_KEY || process.env.API_KEY

  // If no API key is configured, allow access (for development)
  if (!validApiKey) {
    console.warn('⚠️  API key not configured. Allowing access without authentication.')
    return { valid: true }
  }

  // Try to get API key from header first
  const headerApiKey = request.headers.get('X-API-Key') || request.headers.get('x-api-key')

  // Try to get API key from query parameter
  const url = new URL(request.url)
  const queryApiKey = url.searchParams.get('apiKey') || url.searchParams.get('api_key')

  const providedApiKey = headerApiKey || queryApiKey

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
 * Middleware function to validate API key and return error response if invalid
 */
export function requireApiKey(request: Request): NextResponse | null {
  const validation = validateApiKey(request)

  if (!validation.valid) {
    return NextResponse.json(
      {
        status: 'error',
        message: 'Unauthorized',
        error: validation.error,
        timestamp: new Date().toISOString(),
      },
      { status: 401 }
    )
  }

  return null
}

