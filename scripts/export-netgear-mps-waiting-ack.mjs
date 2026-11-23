#!/usr/bin/env node
/**
 * Export system keys with MPS Approved Waiting ACK — same rules as Page 2
 * MPS Approved ACK card: MPS Fully Approved + already exported to Netgear,
 * but ACK not yet Success/Error (Waiting ACK).
 *
 * Usage:
 *   node scripts/export-netgear-mps-waiting-ack.mjs
 *
 * Needs PMIS_DATABASE_URL, or sibling ..\db_credential.txt (postgresql://...).
 * Writes: exports/netgear-mps-waiting-ack-YYYYMMDD-HHmm.xlsx
 */
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import * as XLSX from 'xlsx'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const OUT_DIR = join(ROOT, 'exports')

function loadEnvFile(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvFile(join(ROOT, '.env.local'))
loadEnvFile(join(ROOT, '.sanitation.env'))

function readCredentialUrl() {
  if (process.env.PMIS_DATABASE_URL) return process.env.PMIS_DATABASE_URL
  const credPath = join(ROOT, '..', 'db_credential.txt')
  if (!existsSync(credPath)) throw new Error('Set PMIS_DATABASE_URL or create ../db_credential.txt')
  const line = readFileSync(credPath, 'utf8')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l && !l.startsWith('#') && /^postgres(ql)?:\/\//.test(l))
  if (!line) throw new Error('No postgresql:// URL in db_credential.txt')
  const schemeSep = line.indexOf('://')
  const scheme = line.slice(0, schemeSep)
  const rest = line.slice(schemeSep + 3)
  const at = rest.lastIndexOf('@')
  const userInfo = rest.slice(0, at)
  const hostPart = rest.slice(at + 1)
  const colon = userInfo.indexOf(':')
  return `${scheme}://${encodeURIComponent(userInfo.slice(0, colon))}:${encodeURIComponent(userInfo.slice(colon + 1))}@${hostPart}`
}

const NUM_RE = "'^-{0,1}[0-9]+([.][0-9]+){0,1}$'"
const IN_PO = (col) => `${col} in (select po from scope_po)`

const SQL = `
with scope_po as materialized (
  select distinct po_number po from transaction_po
  where sync_source in ('sap-fusion','fusion') and po_number is not null
),
tx as materialized (
  select p.transaction_id, max(p.update_time) ut
  from mapping_systemkey_po p
  where ${IN_PO('p.po')} and p.transaction_id is not null
  group by 1
),
okx as materialized (
  select tx.transaction_id, tx.ut from tx
  where not exists (
    select 1 from mapping_systemkey_po q
    where q.transaction_id = tx.transaction_id and q.po is not null
      and q.po not in (select po from scope_po)
  )
),
m as (
  select t.mps_transaction_id, max(nullif(t.vendor_code,'')) vc
  from mps_transaction t
  join okx on okx.transaction_id = t.mps_transaction_id
  group by 1
),
b as (
  select distinct on (t.mps_transaction_id) t.mps_transaction_id, t.status_approval
  from mps_transaction t
  join m using (mps_transaction_id)
  order by t.mps_transaction_id, t.id desc
),
sk as materialized (
  select distinct on (p.system_key) p.system_key, p.transaction_id
  from mapping_systemkey_po p
  join okx on okx.transaction_id = p.transaction_id
  where p.system_key is not null and p.system_key <> ''
  order by p.system_key, p.update_time desc nulls last, p.transaction_id desc
),
fa as materialized (
  select sk.system_key sk, m.vc vendor_code, sk.transaction_id
  from sk
  join b on b.mps_transaction_id = sk.transaction_id
  join m on m.mps_transaction_id = sk.transaction_id
  left join mps_status ms on ms.id = b.status_approval
  where coalesce(ms.name, 'Status ' || b.status_approval) = 'MPS Fully Approved'
    and exists (
      select 1 from mapping_systemkey_po p
      where p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
        and p.quanty_mapping ~ ${NUM_RE}
    )
),
latest as materialized (
  select distinct on (
    r.system_key, coalesce(r.transaction_id,''), coalesce(r.po,''), coalesce(r.material_line_item,'')
  )
    r.system_key sk,
    r.transaction_id,
    r.ack_status,
    r.exported_at,
    (coalesce(u.file_name,'') ilike 'backfill%') as is_backfill
  from netgear_mps_approved_rows r
  left join netgear_upload_logs u on u.id = r.upload_log_id
  where r.superseded_at is null and r.system_key in (select sk from fa)
  order by r.system_key, coalesce(r.transaction_id,''), coalesce(r.po,''), coalesce(r.material_line_item,''),
    r.exported_at desc nulls last, r.id desc
),
-- Waiting ACK = real (non-backfill) export only; backfill-only keys excluded.
agg as materialized (
  select sk,
    count(*) lines,
    count(*) filter (where lower(coalesce(ack_status,'')) in ('true','t','1','success')) ok,
    count(*) filter (where lower(coalesce(ack_status,'')) in ('false','f','0','error')) err,
    count(*) filter (
      where lower(coalesce(ack_status,'')) not in ('true','t','1','success','false','f','0','error')
         or ack_status is null
    ) pending,
    max(exported_at) last_exported_at
  from latest
  where not is_backfill
  group by sk
),
waiting as materialized (
  select f.sk, f.vendor_code, f.transaction_id,
    g.lines, g.ok, g.err, g.pending, g.last_exported_at
  from fa f
  join agg g on g.sk = f.sk
  where g.err = 0 and g.ok < g.lines
)
select
  w.sk as system_key,
  w.vendor_code,
  w.transaction_id as mps_transaction_id,
  w.lines as export_lines,
  w.ok as ack_success_lines,
  w.err as ack_error_lines,
  w.pending as waiting_or_blank_ack_lines,
  w.last_exported_at
from waiting w
order by w.sk
`

async function main() {
  const url = readCredentialUrl()
  const client = new pg.Client({ connectionString: url, statement_timeout: 600_000 })
  await client.connect()
  console.error('[export] querying Waiting ACK (MPS Approved Sent without final ACK)...')
  const t0 = Date.now()
  try {
    await client.query('begin read only')
    await client.query("set local work_mem = '256MB'")
    await client.query('set local jit = off')
    const { rows } = await client.query(SQL)
    await client.query('rollback').catch(() => {})
    console.error(`[export] ${rows.length} system keys in ${Date.now() - t0} ms`)

    const summary = rows.map((r) => ({
      system_key: r.system_key,
      vendor_code: r.vendor_code || '',
      mps_transaction_id: r.mps_transaction_id || '',
      export_lines: Number(r.export_lines) || 0,
      ack_success_lines: Number(r.ack_success_lines) || 0,
      ack_error_lines: Number(r.ack_error_lines) || 0,
      waiting_or_blank_ack_lines: Number(r.waiting_or_blank_ack_lines) || 0,
      last_exported_at: r.last_exported_at ? new Date(r.last_exported_at).toISOString() : '',
      ack_status: 'Waiting ACK',
    }))

    mkdirSync(OUT_DIR, { recursive: true })
    const now = new Date()
    const stamp = [
      now.getFullYear(),
      String(now.getMonth() + 1).padStart(2, '0'),
      String(now.getDate()).padStart(2, '0'),
      '-',
      String(now.getHours()).padStart(2, '0'),
      String(now.getMinutes()).padStart(2, '0'),
    ].join('')
    const outPath = join(OUT_DIR, `netgear-mps-waiting-ack-${stamp}.xlsx`)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summary), 'Waiting ACK')
    XLSX.utils.book_append_sheet(
      wb,
      XLSX.utils.aoa_to_sheet([
        ['Filter'],
        ['Same as Page 2 MPS Approved ACK → Waiting ACK'],
        ['Universe: MPS Fully Approved (Fusion scope) with numeric quanty_mapping'],
        ['Already exported with a real (non-backfill) file — backfill-* excluded'],
        ['Waiting = has normal export lines, no ACK Error, not all lines ACK Success'],
        [`Generated: ${new Date().toISOString()}`],
        [`System keys: ${summary.length}`],
      ]),
      'Notes',
    )
    XLSX.writeFile(wb, outPath)
    console.log(outPath)
    console.error(`[export] system keys: ${summary.length}`)
  } finally {
    await client.end()
  }
}

main().catch((e) => {
  console.error('[export] GAGAL:', e.message)
  process.exit(1)
})
