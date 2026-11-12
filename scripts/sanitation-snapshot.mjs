#!/usr/bin/env node
/**
 * Sanitation Report snapshot collector v2 (READ-ONLY terhadap PMIS prod).
 *
 * Menjalankan query agregat SELECT per (vendor, status) ke DB PMIS, lalu menyimpan 1 baris JSON
 * ke tabel Supabase VPS `sanitation_report_snapshots`. Filter vendor dilakukan di browser.
 *
 * Sumber koneksi PMIS (pilih salah satu):
 *   - PMIS_DATABASE_URL  -> driver `pg` (VPS, lewat VPN)
 *   - (default)          -> DBX MCP lokal (dbx-mcp.exe, koneksi "PMIS Prod") untuk laptop
 *
 * Opsi:
 *   --dry-run         cetak ringkasan JSON, tidak menulis ke Supabase
 *   --require-vpn     (VPS) keluar diam-diam jika interface tun0 tidak ada
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Rahasia tidak pernah dicetak.
 */
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SINCE = process.env.SANITATION_SINCE || '2026-10-20'
const DRY = process.argv.includes('--dry-run')
const REQUIRE_VPN = process.argv.includes('--require-vpn')
const DBX_PATH = process.env.DBX_MCP_PATH || 'C:\\Users\\ACER\\.dbx\\bin\\dbx-mcp.exe'
const DBX_CONNECTION = process.env.DBX_CONNECTION || 'PMIS Prod'
const PMIS_DB = process.env.PMIS_DB_NAME || 'pmisdb_20261008'
const QUERY_TIMEOUT_MS = Math.max(1, Number(process.env.SANITATION_QUERY_TIMEOUT_MS) || 60_000)
const UNKNOWN_VENDOR = 'UNKNOWN'

function loadEnvFile(file) {
  if (!existsSync(file)) return
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}
loadEnvFile(join(ROOT, '.env.local'))
loadEnvFile(join(ROOT, '.sanitation.env'))
loadEnvFile('/opt/project-dashboard/.sanitation.env')
loadEnvFile('/opt/project-dashboard/.env')

// Workflow status (MATC/CAC) -> label PMIS
const WF_LABEL = `case wf when 'completed' then 'Fully Approved' when 'in_progress' then 'In Progress'
  when 'rejected' then 'Rejected' else 'No Workflow' end`
const WF_LATEST = (type, key) => `(select w.status from workflow_instances w
  where w.entity_type = '${type}' and w.entity_id = ${key} order by w.version desc, w.id desc limit 1)`
const VENDOR_BY_SYSTEM_KEY = (key) =>
  `(select max(nullif(p.vendor_code,'')) from mapping_systemkey_po p where p.system_key = ${key})`

// Progres Fusion per PATP Fully Approved (rantai GR Control: GI Material -> GR Service -> Fixed Asset).
// Status dibaca dari tabel ACK (bukan interface.ack_status yang tidak andal), baris GATE_FILTERED tidak dihitung
// sebagai terkirim. Kunci ke PATP sama dengan modules/gr-control/acceptance.list.js di PMIS:
//   GI = system_key, GR Service = acceptance_number/ba_reference, Fixed Asset = receipt_number (akhiran _N dibuang).
const PATP_BASE = `select acceptance_number an, max(nullif(vendor_code,'')) v, to_char(max(coalesce(update_time, create_time))::date,'YYYY-MM-DD') d,
    array_agg(distinct system_key) sks, max(status) st
  from list_acceptance where acceptance_number like 'PATP-%' group by 1 having max(coalesce(update_time, create_time)) >= '${SINCE}'`
// BA Value turunan per PATP (PMIS tidak punya kolom ini): sum(mapping_po_sk_quantity x net_price) line material + service ber-PO,
// hanya currency IDR. Quantity = porsi yang di-mapping ke PATP itu (satu line PO bisa dibagi ke banyak PATP). Baris WO-only (tanpa PO) tidak bernilai.
// Dihitung sekali di main() lalu disisipkan (VALUES) ke query yang memakai token PATP_VAL. service_powo_acceptance tidak punya index
// acceptance_number, jadi in-scope PATP difilter lebih dulu lewat CTE materialized (satu seq scan) sebelum join transaction_po.
const PATP_VAL = '__PATP_VAL__'
const PATP_VAL_SQL = `with ans as materialized (select acceptance_number from list_acceptance where acceptance_number like 'PATP-%'
    group by 1 having max(coalesce(update_time, create_time)) >= '${SINCE}'),
  l as materialized (
    select s.acceptance_number, s.po_number, s.line_item, s.mapping_po_sk_quantity from service_powo_acceptance s where s.acceptance_number in (select acceptance_number from ans)
    union all select m.acceptance_number, m.po_number, m.line_item, m.mapping_po_sk_quantity from material_acceptance m where m.acceptance_number in (select acceptance_number from ans))
  select l.acceptance_number an, sum(
      case when l.mapping_po_sk_quantity ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then l.mapping_po_sk_quantity::numeric end
      * case when tp.net_price ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.net_price::numeric end) a
    from l join transaction_po tp on tp.po_number = l.po_number and tp.line_subline = l.line_item
    where upper(trim(coalesce(tp.currency,''))) = 'IDR' group by 1`

const patpLeg = ({ table, ack, match, withSql = '' }) => `with pv as (${PATP_VAL})${withSql ? `, ${withSql}` : ''} select v, s, d, count(*) n, sum(a)::bigint a from (
    select b.v, b.d, coalesce(pv.a, 0) a,
      case when g.lines is null then 'Not Sent' when g.err > 0 then 'ACK Error'
           when g.ok = g.lines then 'ACK Success' else 'Waiting ACK' end s
    from (${PATP_BASE}) b left join pv on pv.an = b.an
    left join lateral (
      select count(*) lines, count(*) filter (where k.ack_status = 'ERROR') err, count(*) filter (where k.ack_status = 'SUCCESS') ok
      from ${table} i
      left join lateral (select a.ack_status from ${ack} a where a.interface_id_ref = i.id
        order by a.processing_date desc nulls last, a.id desc limit 1) k on true
      where ${match} and coalesce(i.export_status,'') <> 'GATE_FILTERED'
      having count(*) > 0) g on true
    where b.st like 'Acceptance Fully Approved%') x group by 1,2,3`

// Satu baris per BA CAC (acceptance_certificate_header) yang modified sejak SINCE; a = BA Value IDR.
const CAC_M = `select ba_number, max(nullif(vendor_code,'')) v, to_char(max(coalesce(updated_at, created_at))::date,'YYYY-MM-DD') d,
              coalesce((select sum(x.lv) from (select distinct d.po_number, d.line_item,
                  case when tp.quantity ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.quantity::numeric end
                  * case when tp.net_price ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.net_price::numeric end lv
                from acceptance_certificate_detail d
                join transaction_po tp on tp.po_number = d.po_number and tp.line_subline = d.line_item
                where d.ba_number = acceptance_certificate_header.ba_number
                  and upper(trim(coalesce(tp.currency,''))) = 'IDR') x), 0) a
            from acceptance_certificate_header
            group by 1 having max(coalesce(updated_at, created_at)) >= '${SINCE}'`

const ACK_LATEST = (ack) => `left join lateral (select a.ack_status from ${ack} a where a.interface_id_ref = i.id
  order by a.processing_date desc nulls last, a.id desc limit 1) k on true`
const CAC_COUNTS = 'count(*) lines, count(*) filter (where k.ack_status = \'ERROR\') err, count(*) filter (where k.ack_status = \'SUCCESS\') ok'
const cacLeg = (kind) => `with b as (
    select m.ba_number ba, m.v, m.d, m.a,
      (select array_agg(distinct x.system_key) from acceptance_certificate_detail x where x.ba_number = m.ba_number and x.system_key is not null) sks,
      (select array_agg(distinct x.po_number) from acceptance_certificate_detail x where x.ba_number = m.ba_number) pos
    from (${CAC_M}) m
    where ${WF_LATEST('acceptance_certificates', 'm.ba_number')} = 'completed')
  select v, s, d, count(*) n, sum(a)::bigint a from (
    select b.v, b.d, b.a,
      case when g.lines is null then 'Not Sent' when g.err > 0 then 'ACK Error'
           when g.ok = g.lines then 'ACK Success' else 'Waiting ACK' end s
    from b
    left join lateral (select array_agg(la.acceptance_number) p from list_acceptance la
      where la.acceptance_category = 'PATP' and la.system_key = any(b.sks)) pn on true
    left join lateral (select ${CAC_COUNTS}, array_agg(distinct i.acceptance_number) sp
      from oracle_fusion_intinv_005_interface i ${ACK_LATEST('oracle_fusion_intinv_005_ack')}
      where coalesce(i.file_type,'') ilike 'service%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and ((i.system_key = any(b.sks) and i.po_numbers = any(b.pos))
          or i.acceptance_number = any(pn.p) or i.ba_reference = any(pn.p)
          or (nullif(trim(i.system_key),'') is null and (i.acceptance_number = b.ba or i.ba_reference = b.ba)))
      having count(*) > 0) sv on true
    ${kind === 'gr' ? 'left join lateral (select sv.lines, sv.err, sv.ok) g on true' : `left join lateral (select ${CAC_COUNTS}
      from oracle_fusion_intppm_002_interface i ${ACK_LATEST('oracle_fusion_intppm_002_ack')}
      where sv.sp is not null and i.po_number = any(b.pos)
        and (i.receipt_number = any(sv.sp)
          or regexp_replace(regexp_replace(i.receipt_number, '_[0-9]+$', ''), '_v[0-9]+[.][0-9]+$', '') = any(sv.sp))
      having count(*) > 0) g on true`}
  ) x group by 1,2,3`

// ---------- Query: semua mengembalikan baris (v = vendor_code, s = status, n = jumlah, x = extra) ----------
const Q = {
  baseline: `select nullif(vendor_code,'') v, regexp_replace(baseline_status, '\\s*:.*$', '') s,
      count(distinct baseline_id) n, coalesce(sum(total_system_key),0) x, to_char(coalesce(update_time, create_time)::date,'YYYY-MM-DD') d
    from baseline where coalesce(update_time, create_time) >= '${SINCE}' group by 1,2,5`,

  // Modified = max(mapping_systemkey_po.update_time) per transaksi (kolom Modified Date list MPS PMIS), fallback created_date.
  mps: `with m as (select t.mps_transaction_id, max(nullif(t.vendor_code,'')) vc,
          to_char(greatest(max(t.created_date), max(p.update_time))::date,'YYYY-MM-DD') d
        from mps_transaction t left join mapping_systemkey_po p on p.transaction_id = t.mps_transaction_id
        group by 1 having greatest(max(t.created_date), max(p.update_time)) >= '${SINCE}'),
      b as (select distinct on (t.mps_transaction_id) t.mps_transaction_id, t.status_approval
        from mps_transaction t join m using (mps_transaction_id) order by t.mps_transaction_id, t.id desc)
    select m.vc v, coalesce(ms.name, 'Status ' || b.status_approval) s, m.d d, count(*) n
    from b join m using (mps_transaction_id) left join mps_status ms on ms.id = b.status_approval
    group by 1,2,3`,

  mpsReserved: `select nullif(vendor_code,'') v, 'Reserved/Ready' s, to_char(coalesce(update_time, create_time)::date,'YYYY-MM-DD') d, count(distinct mps_id) n
    from mapping_systemkey_po where status_id in (1,2) and coalesce(update_time, create_time) >= '${SINCE}' group by 1,3`,

  // `a` = BA Value (IDR) seperti kolom di list Material Certificate PMIS (baValueSql): sum(quantity x net_price) line PO unik (po_number, line_item), hanya currency IDR.
  matc: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select ${VENDOR_BY_SYSTEM_KEY('m.sk')} v, ${WF_LABEL} s, m.d d, m.a a
      from (select mc.ba_number, max(mc.system_key->>0) sk, to_char(max(coalesce(mc.updated_date, mc.created_date))::date,'YYYY-MM-DD') d,
              coalesce((select sum(x.lv) from (select distinct d.po_number, d.line_item,
                  case when tp.quantity ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.quantity::numeric end
                  * case when tp.net_price ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.net_price::numeric end lv
                from material_certificate_details d
                join transaction_po tp on tp.po_number = d.po_number and tp.line_subline = d.line_item
                where d.ba_number = mc.ba_number
                  and upper(trim(coalesce(tp.currency,''))) = 'IDR') x), 0) a
            from material_certificates mc
            group by mc.ba_number having max(coalesce(mc.updated_date, mc.created_date)) >= '${SINCE}') m
      cross join lateral (select ${WF_LATEST('material_certificates', 'm.ba_number')} wf) l) x group by 1,2,3`,

  // ACK dibaca dari tabel ack terbaru per baris (kolom i.ack_status di tabel interface tidak selalu ikut terisi).
  // GR Material (INTINV-005) per BA MATC yang Fully Approved. Aturan sama dengan gate BAST di PMIS:
  // hanya file_type non-service, line yang di-reject GR Control tidak dihitung.
  matcGr: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select ${VENDOR_BY_SYSTEM_KEY('m.sk')} v, m.d d, m.a a,
        case when g.ba_number is null then 'Not Sent' when g.err > 0 then 'ACK Error'
             when g.ok = g.lines then 'ACK Success' when g.sent > 0 then 'Waiting ACK' else 'Not Sent' end s
      from (select ba_number, max(system_key->>0) sk, to_char(max(coalesce(updated_date, created_date))::date,'YYYY-MM-DD') d,
              coalesce((select sum(x.lv) from (select distinct d.po_number, d.line_item,
                  case when tp.quantity ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.quantity::numeric end
                  * case when tp.net_price ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.net_price::numeric end lv
                from material_certificate_details d
                join transaction_po tp on tp.po_number = d.po_number and tp.line_subline = d.line_item
                where d.ba_number = mcx.ba_number
                  and upper(trim(coalesce(tp.currency,''))) = 'IDR') x), 0) a
            from material_certificates mcx
            group by 1 having max(coalesce(updated_date, created_date)) >= '${SINCE}') m
      left join (select i.ba_number, count(*) lines,
                   count(*) filter (where i.export_status = 'EXPORTED' or k.ack_status is not null) sent,
                   count(*) filter (where k.ack_status = 'SUCCESS') ok,
                   count(*) filter (where k.ack_status = 'ERROR') err
                 from oracle_fusion_intinv_005_interface i
                 left join lateral (select a.ack_status from oracle_fusion_intinv_005_ack a where a.interface_id_ref = i.id
                   order by a.processing_date desc nulls last, a.id desc limit 1) k on true
                 where i.ba_number in (select ba_number from material_certificates where coalesce(updated_date, created_date) >= '${SINCE}')
                   and coalesce(i.file_type,'') not ilike 'service%'
                   and not exists (select 1 from material_certificate_details rej where rej.ba_number = i.ba_number
                     and rej.line_item = i.line_item::text and rej.gr_rejected_at is not null)
                 group by 1) g on g.ba_number = m.ba_number
      where ${WF_LATEST('material_certificates', 'm.ba_number')} = 'completed') x group by 1,2,3`,

  patpGi: patpLeg({
    table: 'oracle_fusion_intinv_006_interface', ack: 'oracle_fusion_intinv_006_ack', match: 'i.system_key = any(b.sks)',
  }),
  patpGr: patpLeg({
    table: 'oracle_fusion_intinv_005_interface', ack: 'oracle_fusion_intinv_005_ack',
    match: `(i.acceptance_number = b.an or i.ba_reference = b.an) and coalesce(i.file_type,'') ilike 'service%'`,
  }),
  // Pra-filter ke receipt PATP supaya regexp_replace tidak jalan di seluruh tabel (receipt CAC/BAUT ikut di tabel yang sama).
  patpFa: patpLeg({
    withSql: `fa as (select id, export_status, receipt_number, regexp_replace(receipt_number, '_[0-9]+$', '') rn
      from oracle_fusion_intppm_002_interface where receipt_number like 'PATP-%')`,
    table: 'fa', ack: 'oracle_fusion_intppm_002_ack', match: '(i.receipt_number = b.an or i.rn = b.an)',
  }),

  // `a` = BA Value (IDR) seperti kolom di list PMIS (baValueSql): sum(quantity x net_price) line PO unik (po_number, line_item), hanya currency IDR.
  cac: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select m.v, ${WF_LABEL} s, m.d d, m.a a
      from (${CAC_M}) m
      cross join lateral (select ${WF_LATEST('acceptance_certificates', 'm.ba_number')} wf) l) x group by 1,2,3`,

  // Progres Fusion per BA CAC Fully Approved: GR Service (INTINV-005, file_type service%) dan Fixed Asset (INTPPM-002).
  // Aturan kunci sama dengan modules/commercials/atp-certificate/atp-erp-legs.js di PMIS. `a` = BA Value.
  cacGr: cacLeg('gr'),
  cacFa: cacLeg('fa'),

  acceptance: `with pv as (${PATP_VAL}) select k, v, s, d, count(*) n, sum(a)::bigint a from (
      select case when acceptance_number like 'FATP-%' then 'fatp' else 'patp' end k, acceptance_number,
             max(nullif(vendor_code,'')) v, max(status) s, to_char(max(coalesce(update_time, create_time))::date,'YYYY-MM-DD') d,
             coalesce(max(pv.a), 0) a
      from list_acceptance left join pv on pv.an = list_acceptance.acceptance_number
      where (acceptance_number like 'FATP-%' or acceptance_number like 'PATP-%')
      group by 1,2 having max(coalesce(update_time, create_time)) >= '${SINCE}') x group by 1,2,3,4`,

  endorsement: `with e as (select endorse_number, system_key, min(created_at) c, max(coalesce(updated_at, created_at)) mx, max(nullif(vendor_code,'')) vc
        from endorsements group by 1,2 having max(coalesce(updated_at, created_at)) >= '${SINCE}'),
      l as (select distinct on (e.endorse_number, e.system_key) e.endorse_number, e.vc, e.c, e.mx, h.approval_value
        from e left join endorsement_history_approval h
          on h.system_key = e.system_key and h.created_at >= e.c - interval '1 minute'
        order by e.endorse_number, e.system_key, h.created_at desc, h.id desc),
      per as (select endorse_number, max(vc) v, to_char(max(mx)::date,'YYYY-MM-DD') d, bool_and(approval_value = 'ENDORSE_APPROVED') ap,
                     bool_or(approval_value = 'REJECTED') rj from l group by 1)
    select v, case when ap then 'Fully Approved' when rj then 'Rejected' else 'Waiting Approval' end s, d, count(*) n
    from per group by 1,2,3`,

  caf: `select nullif(d.vendor_code,'') v, coalesce(cs.label, 'Status ' || d.status) s, to_char(coalesce(d.modified_date, d.created_date)::date,'YYYY-MM-DD') dt, count(distinct d.caf_no) n
    from caf_detail d left join caf_status cs on cs.status_id = d.status
    where coalesce(d.modified_date, d.created_date) >= '${SINCE}' group by 1,2,3`,

  cafAction: `select nullif(vendor_code,'') v, 'Approve Waiting Implementation' s, count(distinct caf_no) n
    from caf_detail where status = 12 group by 1`,

  cr: `select v, s, dt, count(*) n from (
      select ${VENDOR_BY_SYSTEM_KEY('d.sk')} v, d.dt,
        (select h.cr_status from cr_history h where h.cr_number = d.cr_number
          order by h.cr_version desc, h.date_status desc nulls last, h.created_date desc nulls last limit 1) s
      from (select c.cr_number, max(c.system_key) sk,
              to_char(coalesce((select max(h.date_status) from cr_history h where h.cr_number = c.cr_number), max(c.created_date))::date,'YYYY-MM-DD') dt
            from cr_document c where c.cr_type = 'Relocation' group by c.cr_number) d where d.dt >= '${SINCE}') x group by 1,2,3`,

  // Dibangun dinamis di main(): hanya vendor yang dipakai (DBX memotong sel >200 karakter, jadi jangan string_agg).
}

// ---------- Guard read-only ----------
const WRITE_RE = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|call|do)\b/i
function assertReadOnly(sql) {
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error('Hanya SELECT/WITH yang diizinkan')
  if (WRITE_RE.test(sql)) throw new Error('Keyword non-read terdeteksi')
}

// ---------- Runner: pg ----------
async function makePgRunner() {
  const { default: pg } = await import('pg')
  const client = new pg.Client({
    connectionString: process.env.PMIS_DATABASE_URL,
    connectionTimeoutMillis: QUERY_TIMEOUT_MS,
    statement_timeout: QUERY_TIMEOUT_MS,
    lock_timeout: 2000,
  })
  await client.connect()
  await client.query('begin read only')
  return {
    async rows(sql) {
      return (await client.query(sql)).rows
    },
    async close() {
      await client.query('rollback').catch(() => {})
      await client.end()
    },
  }
}

// ---------- Runner: DBX (stdio JSON-RPC) ----------
async function makeDbxRunner() {
  const p = spawn(DBX_PATH, [], { stdio: ['pipe', 'pipe', 'ignore'] })
  let buf = ''
  const waiters = []
  p.stdout.on('data', (d) => {
    buf += d.toString('utf8')
    let i
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim()
      buf = buf.slice(i + 1)
      if (line && waiters.length) waiters.shift()(line)
    }
  })
  const recv = () =>
    new Promise((res, rej) => {
      const t = setTimeout(() => rej(new Error('DBX timeout')), QUERY_TIMEOUT_MS)
      waiters.push((l) => { clearTimeout(t); res(l) })
    })
  const send = (o) => p.stdin.write(JSON.stringify(o) + '\n')
  send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'sanitation', version: '1' } } })
  await recv()
  send({ jsonrpc: '2.0', method: 'notifications/initialized' })
  let id = 2
  const PAGE = 100 // DBX membatasi hasil 100 baris per query -> paginasi
  async function page(sql) {
    send({ jsonrpc: '2.0', id: ++id, method: 'tools/call', params: { name: 'dbx_execute_query', arguments: { connection_name: DBX_CONNECTION, database: PMIS_DB, sql } } })
    const msg = JSON.parse(await recv())
    if (msg.error) throw new Error(`DBX error: ${msg.error.message}`)
    const text = msg.result?.content?.[0]?.text || ''
    if (msg.result?.isError) throw new Error(`DBX query error: ${text.slice(0, 300)}`)
    const lines = text.split('\n').filter((l) => l.startsWith('|'))
    if (lines.length < 2) return []
    const cols = lines[0].split('|').slice(1, -1).map((s) => s.trim())
    return lines.slice(2).map((l) => {
      const vals = l.split('|').slice(1, -1).map((s) => s.trim())
      return Object.fromEntries(cols.map((c, i) => [c, vals[i] === 'NULL' ? null : vals[i]]))
    })
  }
  return {
    async rows(sql) {
      const all = []
      for (let off = 0; ; off += PAGE) {
        const part = await page(`select * from (${sql}) q order by q::text limit ${PAGE} offset ${off}`)
        all.push(...part)
        if (part.length < PAGE) return all
        if (off > 50_000) throw new Error('Terlalu banyak baris (paginasi DBX)')
      }
    },
    async close() { p.kill() },
  }
}

// ---------- Normalisasi status + tone ----------
function normalizeStatus(raw) {
  let s = String(raw ?? '').replace(/[\u2013\u2014]/g, '-').replace(/\s+/g, ' ').trim()
  if (!s) return 'Unknown'
  s = s.replace(/\s*-\s*/g, ' - ')
  s = s.replace(/^Waiting for Approval (VP|AVP|SVP|Staff)\b.*$/i, 'Waiting for Approval - $1')
  s = s.replace(/^Waiting Paralel Approval.*$/i, 'Waiting Parallel Approval')
  s = s.replace(/^Waiting for Approval - (VP|AVP|SVP|Staff)\b.*$/i, 'Waiting for Approval - $1')
  s = s.replace(/^Waiting for Approval - Staff\b.*$/i, 'Waiting for Approval - Staff')
  s = s.replace(/\s+:\s*$/, '')
  return s
}
function toneOf(label) {
  const l = label.toLowerCase()
  if (/reject|cancel|dropped|ack error/.test(l)) return 'bad'
  if (/fully approved|fully implemented|^approved|ack success/.test(l)) return 'ok'
  if (/waiting|progress|draft|reserved|ready|await|pending|no workflow|not sent/.test(l)) return 'wait'
  return 'neutral'
}

const n = (v) => Number(v ?? 0) || 0
function toRows(rows, { normalize = true } = {}) {
  const agg = new Map()
  for (const r of rows) {
    const v = r.v || UNKNOWN_VENDOR
    const s = normalize ? normalizeStatus(r.s) : r.s
    const d = r.d || r.dt || null
    const key = `${v}\u0000${s}\u0000${d}`
    const cur = agg.get(key) || { v, s, d, t: toneOf(s), n: 0, x: 0, a: 0, hasA: false }
    cur.n += n(r.n)
    cur.x += n(r.x)
    if (r.a !== undefined) { cur.a += n(r.a); cur.hasA = true }
    agg.set(key, cur)
  }
  return [...agg.values()].map((r) => {
    const o = r.x ? { v: r.v, s: r.s, d: r.d, t: r.t, n: r.n, x: r.x } : { v: r.v, s: r.s, d: r.d, t: r.t, n: r.n }
    if (r.hasA) o.a = r.a
    return o
  })
}

function hasTun0() {
  try { return execSync('ip -br addr show tun0', { stdio: ['ignore', 'pipe', 'ignore'] }).toString().includes('tun0') } catch { return false }
}

async function writeSnapshot(payload) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY belum tersedia')
  const res = await fetch(`${url}/rest/v1/sanitation_report_snapshots?on_conflict=id`, {
    method: 'POST',
    headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify([{ id: 'latest', generated_at: payload.generatedAt, payload }]),
    signal: AbortSignal.timeout(QUERY_TIMEOUT_MS),
  })
  if (!res.ok) throw new Error(`Supabase write gagal: HTTP ${res.status}`)
}

async function main() {
  if (REQUIRE_VPN && !hasTun0()) {
    console.log('[sanitation] VPN tun0 tidak aktif - dilewati, snapshot lama dipertahankan')
    return
  }
  const started = Date.now()
  const runner = process.env.PMIS_DATABASE_URL ? await makePgRunner() : await makeDbxRunner()
  const timings = {}
  const raw = {}
  try {
    assertReadOnly(PATP_VAL_SQL)
    const tv = Date.now()
    const pvRows = await runner.rows(PATP_VAL_SQL)
    timings.patpVal = Date.now() - tv
    const pvSql = pvRows.length
      ? `select an, a::numeric a from (values ${pvRows.map((r) => `('${String(r.an).replace(/'/g, "''")}', ${Number(r.a) || 0})`).join(',')}) t(an, a)`
      : 'select null::text an, 0::numeric a where false'
    for (const [name, rawSql] of Object.entries(Q)) {
      const sql = rawSql.split(PATP_VAL).join(pvSql)
      assertReadOnly(sql)
      const t = Date.now()
      raw[name] = await runner.rows(sql)
      timings[name] = Date.now() - t
    }
    const codes = [...new Set(Object.values(raw).flat().map((r) => r.v).filter(Boolean))]
    const t0 = Date.now()
    const vendorSql = codes.length
      ? `select code, trim(name) as vname from master_vendor where code in (${codes.map((c) => `'${String(c).replace(/'/g, "''")}'`).join(',')})`
      : null
    if (vendorSql) assertReadOnly(vendorSql)
    raw.vendors = vendorSql ? await runner.rows(vendorSql) : []
    timings.vendors = Date.now() - t0
  } finally {
    await runner.close()
  }

  const acc = (k) => raw.acceptance.filter((r) => r.k === k)
  const modules = {
    baseline: toRows(raw.baseline),
    mps: toRows(raw.mps),
    mpsReserved: toRows(raw.mpsReserved, { normalize: false }),
    matc: toRows(raw.matc),
    matcGr: toRows(raw.matcGr),
    fatp: toRows(acc('fatp').map(({ a, ...r }) => r)),
    patp: toRows(acc('patp')),
    patpGi: toRows(raw.patpGi),
    patpGr: toRows(raw.patpGr),
    patpFa: toRows(raw.patpFa),
    cac: toRows(raw.cac),
    cacGr: toRows(raw.cacGr),
    cacFa: toRows(raw.cacFa),
    endorsement: toRows(raw.endorsement),
    caf: toRows(raw.caf),
    crRelocation: toRows(raw.cr),
    cafAction: toRows(raw.cafAction, { normalize: false }),
  }

  const nameByCode = new Map(raw.vendors.filter((r) => r.vname).map((r) => [r.code, r.vname]))
  if (nameByCode.size === 0) throw new Error('master_vendor kosong / gagal dibaca')
  const usedCodes = new Set(Object.values(modules).flat().map((r) => r.v))
  const vendors = [...usedCodes]
    .map((code) => ({ code, name: code === UNKNOWN_VENDOR ? 'Unknown vendor' : nameByCode.get(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name))

  const payload = {
    version: 3,
    generatedAt: new Date().toISOString(),
    since: SINCE,
    durationMs: Date.now() - started,
    timings,
    vendors,
    modules,
  }

  const totals = Object.fromEntries(
    Object.entries(modules).map(([k, rows]) => [k, rows.reduce((s, r) => s + r.n, 0)]),
  )
  const unknownShare = Object.fromEntries(
    ['matc', 'crRelocation', 'mps', 'baseline', 'caf', 'fatp', 'patp', 'cac', 'endorsement'].map((k) => {
      const tot = totals[k] || 1
      const unk = modules[k].filter((r) => r.v === UNKNOWN_VENDOR).reduce((s, r) => s + r.n, 0)
      return [k, `${((1 - unk / tot) * 100).toFixed(1)}%`]
    }),
  )

  if (DRY) {
    console.log(JSON.stringify({ totals, vendorCoverage: unknownShare, vendors: vendors.length, timings, durationMs: payload.durationMs, bytes: JSON.stringify(payload).length }, null, 2))
  } else {
    await writeSnapshot(payload)
    console.log(`[sanitation] snapshot v3 ditulis (${payload.durationMs} ms, ${JSON.stringify(payload).length} bytes)`)
  }
}

main().catch((e) => {
  console.error('[sanitation] GAGAL:', e.message)
  process.exit(1)
})
