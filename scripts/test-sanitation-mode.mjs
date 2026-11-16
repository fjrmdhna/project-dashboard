#!/usr/bin/env node
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const src = readFileSync(new URL('./sanitation-snapshot.mjs', import.meta.url), 'utf8')
const loaded = src.indexOf("loadEnvFile(join(ROOT, '.sanitation.env'))")
const mode = src.indexOf('const USE_PG = !!process.env.PMIS_DATABASE_URL')
const timeout = src.indexOf('const QUERY_TIMEOUT_MS =')
assert.ok(loaded >= 0 && mode > loaded && timeout > loaded, 'load protected env before selecting mode and query timeout')
assert.match(src, /if \(USE_PG && failed\.length && !ONLY\) throw new Error\(/, 'normal PostgreSQL run must not publish a partial snapshot as fresh')
console.log('sanitation mode and partial-snapshot guard OK')
