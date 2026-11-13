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
 *   Scope: PO dengan transaction_po.sync_source 'sap-fusion' / 'fusion' (tanpa batas tanggal).
 *   SANITATION_DAILY_DAYS=N  data lebih tua dari N hari digabung per bulan (default 0 = harian penuh).
 *   --require-vpn     (VPS) keluar diam-diam jika interface tun0 tidak ada
 *
 * Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY. Rahasia tidak pernah dicetak.
 */
import { spawn, execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const DRY = process.argv.includes('--dry-run')
const VERBOSE = DRY || !!process.env.SANITATION_VERBOSE
const ONLY = DRY && process.env.SANITATION_ONLY ? process.env.SANITATION_ONLY.split(',') : null // debug: jalankan sebagian query
const REQUIRE_VPN = process.argv.includes('--require-vpn')
const DBX_PATH = process.env.DBX_MCP_PATH || 'C:\\Users\\ACER\\.dbx\\bin\\dbx-mcp.exe'
const DBX_CONNECTION = process.env.DBX_CONNECTION || 'PMIS Prod'
const PMIS_DB = process.env.PMIS_DB_NAME || 'pmisdb_20261008'
const QUERY_TIMEOUT_MS = Math.max(1, Number(process.env.SANITATION_QUERY_TIMEOUT_MS) || 180_000)
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

// ---------- Scope sumber: hanya PO dengan transaction_po.sync_source 'sap-fusion' dan 'fusion' ----------
// Tanpa batas tanggal. Himpunan PO (±15 rb) dan system_key-nya dihitung di dalam DB sebagai CTE materialized (jangan ditarik ke Node:
// DBX hanya 100 baris/query). Entitas yang tersambung ke PO di luar scope (legacy) dikeluarkan sepenuhnya ("takeout").
// Debug (hanya --dry-run): SANITATION_SCOPE_LIMIT=N membatasi scope ke N PO pertama agar uji alur penuh lewat DBX cepat.
const SCOPE_LIMIT = DRY && Number(process.env.SANITATION_SCOPE_LIMIT) > 0 ? ` order by 1 limit ${Math.floor(Number(process.env.SANITATION_SCOPE_LIMIT))}` : ''
const CTE_SCOPE = `scope_po as materialized (select distinct po_number po from transaction_po
    where sync_source in ('sap-fusion','fusion') and po_number is not null${SCOPE_LIMIT}),
  scope_sk as materialized (select distinct system_key sk from mapping_systemkey_po
    where po in (select po from scope_po) and system_key is not null)`
const withScope = (sql) => (/^\s*with\s/i.test(sql) ? sql.replace(/^\s*with\s+/i, `with ${CTE_SCOPE}, `) : `with ${CTE_SCOPE} ${sql}`)
const IN_PO = (col) => `${col} in (select po from scope_po)`
// caf_detail.system_key bertipe jsonb array: CAF masuk scope bila salah satu system_key-nya ada di scope (di-unnest sekali, hash join).
const CAF_SCOPE_CTE = `scope_caf as materialized (select distinct d0.caf_no from caf_detail d0
    cross join lateral jsonb_array_elements_text(d0.system_key) kk(v) join scope_sk s on s.sk = kk.v)`
const IN_SK = (col) => `${col} in (select sk from scope_sk)`
// Scope per BA: punya >=1 PO scope dan tidak punya PO di luar scope. `col` harus ter-qualify (mis. mc.ba_number).
const BA_SCOPE = (table, col) => `${col} in (select x.ba_number from ${table} x where ${IN_PO('x.po_number')})
    and not exists (select 1 from ${table} y where y.ba_number = ${col} and y.po_number is not null and y.po_number not in (select po from scope_po))`
// Scope per acceptance (PATP/FATP): punya >=1 system_key scope dan tidak ada system_key di luar scope.
const ACC_HAVING = `having bool_or(${IN_SK('system_key')}) and bool_and(system_key is null or ${IN_SK('system_key')})`
// Tanggal modified. SANITATION_DAILY_DAYS>0: data lebih tua dari N hari digabung per bulan (tanggal = awal bulan) agar payload ringan.
const BUCKET_DAYS = Math.max(0, Number(process.env.SANITATION_DAILY_DAYS) || 0)
const DT = (e) => BUCKET_DAYS > 0
  ? `to_char(case when (${e}) >= current_date - ${BUCKET_DAYS} then (${e})::date else date_trunc('month', ${e})::date end,'YYYY-MM-DD')`
  : `to_char((${e})::date,'YYYY-MM-DD')`

// Progres Fusion per PATP Fully Approved (rantai GR Control: GI Material -> GR Service -> Fixed Asset).
// Status dibaca dari tabel ACK (bukan interface.ack_status yang tidak andal), baris GATE_FILTERED tidak dihitung
// sebagai terkirim. Kunci ke PATP sama dengan modules/gr-control/acceptance.list.js di PMIS:
//   GI = system_key, GR Service = acceptance_number/ba_reference, Fixed Asset = receipt_number (akhiran _N dibuang).
const PATP_BASE = `select acceptance_number an, max(nullif(vendor_code,'')) v, ${DT('max(coalesce(update_time, create_time))')} d,
    array_agg(distinct system_key) sks, max(status) st
  from list_acceptance where acceptance_number like 'PATP-%' group by 1 ${ACC_HAVING}`
// BA Value turunan per PATP (PMIS tidak punya kolom ini) = Current Realisation: sum(qty x net_price) line material + service ber-PO,
// hanya currency IDR. qty = least(mapping_po_sk_quantity, quanty_mapping per PO/line/system key PATP): sebagian baris PATP menyimpan
// qty penuh line PO (membengkak), sedangkan mapping per system key adalah porsi sebenarnya. Tanpa mapping -> pakai mapping_po_sk_quantity.
// Harga = transaction_po terbaru (dedup). Baris WO-only (tanpa PO) tidak bernilai.
// Dihitung di DB (CTE materialized) di setiap query yang memakai token PATP_VAL.
const PATP_VAL = '__PATP_VAL__'
const NUM_RE = "'^-{0,1}[0-9]+([.][0-9]+){0,1}$'"
const PATP_VAL_SQL = `with ans as materialized (select acceptance_number, max(system_key) sk from list_acceptance where acceptance_number like 'PATP-%'
    group by 1 ${ACC_HAVING}),
  l as materialized (
    select s.acceptance_number, s.po_number, s.line_item, s.mapping_po_sk_quantity from service_powo_acceptance s where s.acceptance_number in (select acceptance_number from ans)
    union all select m.acceptance_number, m.po_number, m.line_item, m.mapping_po_sk_quantity from material_acceptance m where m.acceptance_number in (select acceptance_number from ans)),
  mp as materialized (select distinct on (po, material_line_item, system_key) po, material_line_item, system_key, quanty_mapping
    from mapping_systemkey_po where po in (select po_number from l) order by po, material_line_item, system_key, id desc)
  select l.acceptance_number an, sum(
      case when l.mapping_po_sk_quantity ~ ${NUM_RE} then least(l.mapping_po_sk_quantity::numeric,
            case when mp.quanty_mapping::text ~ ${NUM_RE} then mp.quanty_mapping::numeric else l.mapping_po_sk_quantity::numeric end) end
      * case when tp.net_price ~ ${NUM_RE} then tp.net_price::numeric end) a
    from l join ans on ans.acceptance_number = l.acceptance_number
    left join mp on mp.po = l.po_number and mp.material_line_item = l.line_item and mp.system_key = ans.sk
    join lateral (select t.net_price, t.currency from transaction_po t where t.po_number = l.po_number and t.line_subline = l.line_item
      order by t.created_at desc, t.id desc limit 1) tp on true
    where upper(trim(coalesce(tp.currency,''))) = 'IDR' group by 1`

// Leg PATP (GI/GR/FA) dan total PATP/FATP dihitung dalam SATU query supaya nilai (pv) dan himpunan PATP (b) hanya dibangun sekali.
// Cabang memakai CTE `b` (PATP Fully Approved + progres) dan `pv` (BA Value). Hasil diberi tag k.
const patpLeg = ({ k, table, ack, match }) => `select '${k}' k, v, s, d, count(*) n, sum(a)::bigint a from (
    select b.v, b.d, coalesce(pv.a, 0) a,
      case when g.lines is null then 'Not Sent' when g.err > 0 then 'ACK Error'
           when g.ok = g.lines then 'ACK Success' else 'Waiting ACK' end s
    from b left join pv on pv.an = b.an
    left join lateral (
      select count(*) lines, count(*) filter (where k.ack_status = 'ERROR') err, count(*) filter (where k.ack_status = 'SUCCESS') ok
      from ${table} i
      left join lateral (select a.ack_status from ${ack} a where a.interface_id_ref = i.id
        order by a.processing_date desc nulls last, a.id desc limit 1) k on true
      where ${match} and coalesce(i.export_status,'') <> 'GATE_FILTERED'
      having count(*) > 0) g on true
    where b.st like 'Acceptance Fully Approved%') x group by 2,3,4`

// Satu baris per BA CAC (acceptance_certificate_header) dalam scope; a = BA Value IDR = Realisation Total Appendix 2 ATP:
// sum(quanty_mapping baris mapping detail x net_price PO terbaru), hanya line IDR (bukan quantity penuh line PO).
const CAC_M = `select ba_number, max(nullif(vendor_code,'')) v, ${DT('max(coalesce(updated_at, created_at))')} d,
              coalesce((select sum(x.lv) from (select d.id,
                  case when m.quanty_mapping ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then m.quanty_mapping::numeric end
                  * case when tp.net_price ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.net_price::numeric end lv
                from acceptance_certificate_detail d
                join lateral (select m0.quanty_mapping, m0.po, m0.material_line_item from mapping_systemkey_po m0
                  where nullif(d.system_key,'') is not null
                    and ((d.mapping_id is not null and m0.id = d.mapping_id)
                      or (d.mapping_id is null and m0.po = d.po_number and m0.material_line_item = d.line_item
                          and m0.system_key = d.system_key and m0.network_header is not distinct from d.network_header))
                  order by m0.id desc limit 1) m on true
                join lateral (select t.net_price, t.currency from transaction_po t
                  where t.po_number = m.po and t.line_subline = m.material_line_item
                  order by t.created_at desc, t.id desc limit 1) tp on true
                where d.ba_number = acceptance_certificate_header.ba_number
                  and upper(trim(coalesce(tp.currency,''))) = 'IDR') x), 0) a
            from acceptance_certificate_header
            where ${BA_SCOPE('acceptance_certificate_detail', 'acceptance_certificate_header.ba_number')}
            group by 1`

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

// BA Value (IDR) per BA MATC = Current Realization Appendix 2 MATC: sum(purpose_gr_qty (kosong/0 -> quanty_mapping) x net_price PO terbaru), hanya IDR.
const MATC_BA = (alias) => `select ${alias}.ba_number, max(${alias}.system_key->>0) sk, ${DT(`max(coalesce(${alias}.updated_date, ${alias}.created_date))`)} d,
              coalesce((select sum(x.lv) from (select d.id,
                  coalesce(nullif(d.purpose_gr_qty, 0), case when m.quanty_mapping ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then m.quanty_mapping::numeric end)
                  * case when tp.net_price ~ '^-{0,1}[0-9]+([.][0-9]+){0,1}$' then tp.net_price::numeric end lv
                from material_certificate_details d
                left join lateral (select m0.quanty_mapping from mapping_systemkey_po m0
                  where m0.po = d.po_number and m0.material_line_item = d.line_item and m0.system_key = d.system_key
                  order by m0.id desc limit 1) m on true
                join lateral (select t.net_price, t.currency from transaction_po t
                  where t.po_number = d.po_number and t.line_subline = d.line_item
                  order by t.created_at desc, t.id desc limit 1) tp on true
                where d.ba_number = ${alias}.ba_number
                  and upper(trim(coalesce(tp.currency,''))) = 'IDR') x), 0) a
            from material_certificates ${alias}
            where ${BA_SCOPE('material_certificate_details', `${alias}.ba_number`)}
            group by ${alias}.ba_number`

// ---------- Query: semua mengembalikan baris (v = vendor_code, s = status, n = jumlah, x = extra) ----------
const Q = {
  baseline: `select nullif(vendor_code,'') v, regexp_replace(baseline_status, '\\s*:.*$', '') s,
      count(distinct baseline_id) n, coalesce(sum(total_system_key),0) x, ${DT('coalesce(update_time, create_time)')} d
    from baseline where ${IN_PO('po_number')} group by 1,2,5`,

  // Modified = max(mapping_systemkey_po.update_time) per transaksi (kolom Modified Date list MPS PMIS), fallback created_date.
  // Transaksi yang punya PO legacy dikeluarkan.
  mps: `with tx as materialized (select p.transaction_id, max(p.update_time) ut from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
      okx as materialized (select tx.transaction_id, tx.ut from tx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = tx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
      m as (select t.mps_transaction_id, max(nullif(t.vendor_code,'')) vc,
          ${DT('greatest(max(t.created_date), max(okx.ut))')} d
        from mps_transaction t join okx on okx.transaction_id = t.mps_transaction_id group by 1),
      b as (select distinct on (t.mps_transaction_id) t.mps_transaction_id, t.status_approval
        from mps_transaction t join m using (mps_transaction_id) order by t.mps_transaction_id, t.id desc)
    select m.vc v, coalesce(ms.name, 'Status ' || b.status_approval) s, m.d d, count(*) n
    from b join m using (mps_transaction_id) left join mps_status ms on ms.id = b.status_approval
    group by 1,2,3`,

  mpsReserved: `select nullif(vendor_code,'') v, 'Reserved/Ready' s, ${DT('coalesce(update_time, create_time)')} d, count(distinct mps_id) n
    from mapping_systemkey_po where status_id in (1,2) and ${IN_PO('po')} group by 1,3`,

  matc: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select ${VENDOR_BY_SYSTEM_KEY('m.sk')} v, ${WF_LABEL} s, m.d d, m.a a
      from (${MATC_BA('mc')}) m
      cross join lateral (select ${WF_LATEST('material_certificates', 'm.ba_number')} wf) l) x group by 1,2,3`,

  // ACK dibaca dari tabel ack terbaru per baris (kolom i.ack_status di tabel interface tidak selalu ikut terisi).
  // GR Material (INTINV-005) per BA MATC yang Fully Approved. Aturan sama dengan gate BAST di PMIS:
  // hanya file_type non-service, line yang di-reject GR Control tidak dihitung.
  matcGr: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select ${VENDOR_BY_SYSTEM_KEY('m.sk')} v, m.d d, m.a a,
        case when g.ba_number is null then 'Not Sent' when g.err > 0 then 'ACK Error'
             when g.ok = g.lines then 'ACK Success' when g.sent > 0 then 'Waiting ACK' else 'Not Sent' end s
      from (${MATC_BA('mcx')}) m
      left join (select i.ba_number, count(*) lines,
                   count(*) filter (where i.export_status = 'EXPORTED' or k.ack_status is not null) sent,
                   count(*) filter (where k.ack_status = 'SUCCESS') ok,
                   count(*) filter (where k.ack_status = 'ERROR') err
                 from oracle_fusion_intinv_005_interface i
                 left join lateral (select a.ack_status from oracle_fusion_intinv_005_ack a where a.interface_id_ref = i.id
                   order by a.processing_date desc nulls last, a.id desc limit 1) k on true
                 where coalesce(i.file_type,'') not ilike 'service%'
                   and not exists (select 1 from material_certificate_details rej where rej.ba_number = i.ba_number
                     and rej.line_item = i.line_item::text and rej.gr_rejected_at is not null)
                 group by 1) g on g.ba_number = m.ba_number
      where ${WF_LATEST('material_certificates', 'm.ba_number')} = 'completed') x group by 1,2,3`,

  // Fixed Asset (INTPPM-002): kunci receipt_number atau receipt_number tanpa akhiran _N. Dihitung per kunci SEKALI (hash join), bukan per PATP:
  // dengan 48 rb PATP, pencocokan regexp per baris (lateral) melewati batas 60 dtk. Pra-filter receipt PATP (tabel yang sama berisi receipt CAC/BAUT).
  patpAll: `with pv as materialized (${PATP_VAL}),
    b as materialized (${PATP_BASE}),
    fa as materialized (select i.id, i.export_status, kk.kx from oracle_fusion_intppm_002_interface i
      cross join lateral (select distinct x kx from (values (i.receipt_number), (regexp_replace(i.receipt_number, '_[0-9]+$', ''))) v(x)) kk
      where i.receipt_number like 'PATP-%'),
    fl as materialized (select f.kx, count(*) lines, count(*) filter (where k.ack_status = 'ERROR') err, count(*) filter (where k.ack_status = 'SUCCESS') ok
      from fa f left join lateral (select a.ack_status from oracle_fusion_intppm_002_ack a where a.interface_id_ref = f.id
        order by a.processing_date desc nulls last, a.id desc limit 1) k on true
      where coalesce(f.export_status,'') <> 'GATE_FILTERED' group by f.kx)
    ${patpLeg({ k: 'patpGi', table: 'oracle_fusion_intinv_006_interface', ack: 'oracle_fusion_intinv_006_ack', match: 'i.system_key = any(b.sks)' })}
    union all ${patpLeg({
      k: 'patpGr', table: 'oracle_fusion_intinv_005_interface', ack: 'oracle_fusion_intinv_005_ack',
      match: "(i.acceptance_number = b.an or i.ba_reference = b.an) and coalesce(i.file_type,'') ilike 'service%'",
    })}
    union all select 'patpFa' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, coalesce(pv.a, 0) a,
        case when g.lines is null then 'Not Sent' when g.err > 0 then 'ACK Error'
             when g.ok = g.lines then 'ACK Success' else 'Waiting ACK' end s
      from b left join pv on pv.an = b.an left join fl g on g.kx = b.an
      where b.st like 'Acceptance Fully Approved%') x group by 2,3,4
    union all select k, v, s, d, n, a from (
      select k, v, s, d, count(*) n, sum(a)::bigint a from (
        select case when acceptance_number like 'FATP-%' then 'fatp' else 'patp' end k, acceptance_number,
               max(nullif(vendor_code,'')) v, max(status) s, ${DT('max(coalesce(update_time, create_time))')} d,
               coalesce(max(pv.a), 0) a
        from list_acceptance left join pv on pv.an = list_acceptance.acceptance_number
        where (acceptance_number like 'FATP-%' or acceptance_number like 'PATP-%')
        group by 1,2 ${ACC_HAVING}) y group by 1,2,3,4) z`,

  cac: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select m.v, ${WF_LABEL} s, m.d d, m.a a
      from (${CAC_M}) m
      cross join lateral (select ${WF_LATEST('acceptance_certificates', 'm.ba_number')} wf) l) x group by 1,2,3`,

  // Progres Fusion per BA CAC Fully Approved: GR Service (INTINV-005, file_type service%) dan Fixed Asset (INTPPM-002).
  // Aturan kunci sama dengan modules/commercials/atp-certificate/atp-erp-legs.js di PMIS. `a` = BA Value.
  cacGr: cacLeg('gr'),
  cacFa: cacLeg('fa'),

  endorsement: `with e as (select endorse_number, system_key, min(created_at) c, max(coalesce(updated_at, created_at)) mx, max(nullif(vendor_code,'')) vc
        from endorsements where ${IN_PO('po_number')} or ${IN_SK('system_key')} group by 1,2),
      l as (select distinct on (e.endorse_number, e.system_key) e.endorse_number, e.vc, e.c, e.mx, h.approval_value
        from e left join endorsement_history_approval h
          on h.system_key = e.system_key and h.created_at >= e.c - interval '1 minute'
        order by e.endorse_number, e.system_key, h.created_at desc, h.id desc),
      per as (select endorse_number, max(vc) v, ${DT('max(mx)')} d, bool_and(approval_value = 'ENDORSE_APPROVED') ap,
                     bool_or(approval_value = 'REJECTED') rj from l group by 1)
    select v, case when ap then 'Fully Approved' when rj then 'Rejected' else 'Waiting Approval' end s, d, count(*) n
    from per group by 1,2,3`,

  caf: `with ${CAF_SCOPE_CTE} select nullif(d.vendor_code,'') v, coalesce(cs.label, 'Status ' || d.status) s, ${DT('coalesce(d.modified_date, d.created_date)')} dt, count(distinct d.caf_no) n
    from caf_detail d left join caf_status cs on cs.status_id = d.status
    where d.caf_no in (select caf_no from scope_caf) group by 1,2,3`,

  // Backlog CAF menunggu implementasi. d = modified terakhir per CAF supaya filter tanggal ikut berlaku.
  cafAction: `with ${CAF_SCOPE_CTE} select v, s, d, count(*) n from (
      select nullif(vendor_code,'') v, 'Approve Waiting Implementation' s, ${DT('max(coalesce(modified_date, created_date))')} d
      from caf_detail where status = 12 and caf_no in (select caf_no from scope_caf) group by caf_no, 1) x group by 1,2,3`,

  cr: `select v, s, dt, count(*) n from (
      select ${VENDOR_BY_SYSTEM_KEY('d.sk')} v, d.dt,
        (select h.cr_status from cr_history h where h.cr_number = d.cr_number
          order by h.cr_version desc, h.date_status desc nulls last, h.created_date desc nulls last limit 1) s
      from (select c.cr_number, max(c.system_key) sk,
              ${DT('coalesce((select max(h.date_status) from cr_history h where h.cr_number = c.cr_number), max(c.created_date))')} dt
            from cr_document c where c.cr_type = 'Relocation' and ${IN_PO('c.po_number')} group by c.cr_number) d) x group by 1,2,3`,

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
      if (process.env.SANITATION_COUNT) { // debug: total + jumlah baris tanpa paginasi (ukur waktu server saja)
        const g = sql.includes("'patpGi' k")
        return await page(`select ${g ? 'k,' : ''} sum(n) n, count(*) r from (${sql}) q ${g ? 'group by k' : ''}`)
      }
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
    for (const [name, rawSql] of Object.entries(Q)) {
      if (ONLY && !ONLY.includes(name)) { raw[name] = []; continue }
      const sql = withScope(rawSql.split(PATP_VAL).join(PATP_VAL_SQL))
      assertReadOnly(sql)
      const t = Date.now()
      raw[name] = await runner.rows(sql)
      timings[name] = Date.now() - t
      if (VERBOSE) console.error(`[sanitation] ${name}: ${process.env.SANITATION_COUNT ? JSON.stringify(raw[name]) : raw[name].length + ' baris'}, ${timings[name]} ms`)
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

  const part = (k) => raw.patpAll.filter((r) => r.k === k)
  const modules = {
    baseline: toRows(raw.baseline),
    mps: toRows(raw.mps),
    mpsReserved: toRows(raw.mpsReserved, { normalize: false }),
    matc: toRows(raw.matc),
    matcGr: toRows(raw.matcGr),
    fatp: toRows(part('fatp').map(({ a, ...r }) => r)),
    patp: toRows(part('patp')),
    patpGi: toRows(part('patpGi')),
    patpGr: toRows(part('patpGr')),
    patpFa: toRows(part('patpFa')),
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

  const earliest = Object.values(modules).flat().map((r) => r.d).filter(Boolean).sort()[0] || null
  const payload = {
    version: 3,
    generatedAt: new Date().toISOString(),
    since: earliest,
    scope: 'sap-fusion,fusion',
    dailyDays: BUCKET_DAYS,
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
