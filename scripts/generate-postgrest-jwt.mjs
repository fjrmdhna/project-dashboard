#!/usr/bin/env node
/**
 * Generate HS256 JWTs for PostgREST (anon + service_role).
 * Usage: node scripts/generate-postgrest-jwt.mjs <jwt_secret>
 */
import crypto from 'crypto'

const secret = process.argv[2]
if (!secret || secret.length < 32) {
  console.error('Usage: node scripts/generate-postgrest-jwt.mjs <jwt_secret_min_32_chars>')
  process.exit(1)
}

function b64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function sign(payload) {
  const header = b64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = b64url(JSON.stringify(payload))
  const data = `${header}.${body}`
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
  return `${data}.${sig}`
}

const now = Math.floor(Date.now() / 1000)
const exp = now + 60 * 60 * 24 * 365 * 10 // 10 years

const anon = sign({
  role: 'anon',
  iss: 'project-dashboard',
  iat: now,
  exp,
})

const service = sign({
  role: 'service_role',
  iss: 'project-dashboard',
  iat: now,
  exp,
})

console.log(JSON.stringify({ NEXT_PUBLIC_SUPABASE_ANON_KEY: anon, SUPABASE_SERVICE_ROLE_KEY: service }, null, 2))
