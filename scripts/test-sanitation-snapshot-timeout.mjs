#!/usr/bin/env node
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import net from 'node:net'

const server = net.createServer(() => {})
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
const { port } = server.address()
const started = Date.now()
const child = spawn(process.execPath, ['scripts/sanitation-snapshot.mjs', '--dry-run'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: {
    ...process.env,
    PMIS_DATABASE_URL: `postgresql://test:test@127.0.0.1:${port}/test`,
    SANITATION_QUERY_TIMEOUT_MS: '500',
  },
  stdio: ['ignore', 'pipe', 'pipe'],
})
let output = ''
child.stdout.on('data', (chunk) => { output += chunk })
child.stderr.on('data', (chunk) => { output += chunk })
const watchdog = setTimeout(() => child.kill('SIGTERM'), 4_000)
const code = await new Promise((resolve) => child.once('close', resolve))
clearTimeout(watchdog)
server.close()
const elapsed = Date.now() - started

assert.notEqual(code, 0, 'collector must fail when PostgreSQL handshake never responds')
assert.ok(elapsed < 3_000, `collector must time out promptly; elapsed=${elapsed}ms output=${output}`)
console.log(`sanitation connection timeout OK (${elapsed} ms)`)
