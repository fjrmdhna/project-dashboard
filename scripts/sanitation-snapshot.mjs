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
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
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

const DRY = process.argv.includes('--dry-run')
// Selalu log progress per query (DBX sekuensial bisa >10 mnt; tanpa log terlihat hang).
const VERBOSE = true
// Boleh dipakai tanpa --dry-run (merge modul lain dari snapshot sebelumnya).
const ONLY = process.env.SANITATION_ONLY ? process.env.SANITATION_ONLY.split(',') : null
const REQUIRE_VPN = process.argv.includes('--require-vpn')
const DBX_PATH = process.env.DBX_MCP_PATH || 'C:\\Users\\ACER\\.dbx\\bin\\dbx-mcp.exe'
const DBX_CONNECTION = process.env.DBX_CONNECTION || 'PMIS Prod'
const PMIS_DB = process.env.PMIS_DB_NAME || 'pmisdb_20261008'
// Default 5 mnt/query ringan; query berat (patp/fusion/cac) default 10 mnt.
// Tes CI set SANITATION_QUERY_TIMEOUT_MS pendek → heavy/connect ikut pendek (jangan floor 600s).
const QUERY_TIMEOUT_MS = Math.max(1, Number(process.env.SANITATION_QUERY_TIMEOUT_MS) || 300_000)
const HEAVY_TIMEOUT_MS = Math.max(
  QUERY_TIMEOUT_MS,
  Number(process.env.SANITATION_HEAVY_TIMEOUT_MS) || (QUERY_TIMEOUT_MS < 60_000 ? QUERY_TIMEOUT_MS : 600_000),
)
const UNKNOWN_VENDOR = 'UNKNOWN'

/** true = driver pg (paralel, timeout panjang). false = DBX sekuensial. */
const USE_PG = !!process.env.PMIS_DATABASE_URL
/**
 * Di DBX, patpAll/patpFunnel hampir selalu timeout 60s dan menduplikasi CTE need.
 * Default: skip + inherit dari snapshot lama. Paksa jalan: SANITATION_FORCE_PATP=1.
 */
const SKIP_PATP_ON_DBX = !USE_PG && process.env.SANITATION_FORCE_PATP !== '1'

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

/** PO-AUC migration SKs di-skip scheduler INTINV-007 (ops kit). File lokal = salinan PMIS BE. */
function loadMigrationSkCte() {
  const paths = [
    join(ROOT, 'scripts', 'data', 'po-auc-migration-sk.json'),
    join(ROOT, '..', 'PMIS Code', 'be-pmis-aj-production', 'modules', 'oracle-fusion', 'po-auc-migration-sk.json'),
  ]
  for (const p of paths) {
    if (!existsSync(p)) continue
    try {
      const keys = JSON.parse(readFileSync(p, 'utf8'))
      if (!Array.isArray(keys) || !keys.length) continue
      const lit = keys.map((k) => `'${String(k).replace(/'/g, "''")}'`).join(',')
      return `mig_sk as materialized (select unnest(ARRAY[${lit}]::text[]) as sk),`
    } catch {
      /* coba path berikutnya */
    }
  }
  return 'mig_sk as materialized (select null::text as sk where false),'
}
const MIG_SK_CTE = loadMigrationSkCte()
// caf_detail.system_key bertipe jsonb array: CAF masuk scope bila salah satu system_key-nya ada di scope (di-unnest sekali, hash join).
const CAF_SCOPE_CTE = `scope_caf as materialized (select distinct d0.caf_no from caf_detail d0
    cross join lateral jsonb_array_elements_text(d0.system_key) kk(v) join scope_sk s on s.sk = kk.v)`
const IN_SK = (col) => `${col} in (select sk from scope_sk)`
// Scope per BA: punya >=1 PO scope dan tidak punya PO di luar scope. `col` harus ter-qualify (mis. mc.ba_number).
const BA_SCOPE = (table, col) => `${col} in (select x.ba_number from ${table} x where ${IN_PO('x.po_number')})
    and not exists (select 1 from ${table} y where y.ba_number = ${col} and y.po_number is not null and y.po_number not in (select po from scope_po))`
// Tanggal modified. SANITATION_DAILY_DAYS>0: data lebih tua dari N hari digabung per bulan (tanggal = awal bulan) agar payload ringan.
const BUCKET_DAYS = Math.max(0, Number(process.env.SANITATION_DAILY_DAYS) || 0)
const DT = (e) => BUCKET_DAYS > 0
  ? `to_char(case when (${e}) >= current_date - ${BUCKET_DAYS} then (${e})::date else date_trunc('month', ${e})::date end,'YYYY-MM-DD')`
  : `to_char((${e})::date,'YYYY-MM-DD')`

// PATP/FATP: 1 system key = 1 hitungan (unik per jenis). Status = acceptance TERBARU untuk system key itu
// (update_time/create_time, tie-break acceptance_number). Scope = system_key di scope_sk Fusion.
// Funnel Fusion per Fully Approved system key (status terbaru Fully Approved). Kunci sama GR Control PMIS:
//   GI = system_key, GR Service = acceptance_number/ba_reference terbaru SK, Fixed Asset = receipt_number (strip _N).
// ACK dari tabel ack terbaru; GATE_FILTERED tidak dihitung terkirim.
// Rp PATP = Current Realisation per (acceptance terbaru, system key): qty x net_price IDR line ber-PO.
const NUM_RE = "'^-{0,1}[0-9]+([.][0-9]+){0,1}$'"

// Status ACK funnel dari agregat hash-join (bukan lateral per system key).
const FUNNEL_STATUS = `case when g.lines is null then 'Not Sent' when g.err > 0 then 'ACK Error'
           when g.ok = g.lines then 'ACK Success' else 'Waiting ACK' end`

// Line SERVICE (tidak dihitung): material_type berawalan Y, 'Network Service', atau mengandung 'Svc'. Selain itu = material.
const IS_SVC = (a) => `(coalesce(${a}.material_type,'') ilike 'Y%' or coalesce(${a}.material_type,'') = 'Network Service' or coalesce(${a}.material_type,'') ilike '%Svc%')`

/**
 * Prefiks CTE PATP. withMtSc=true (jalur pg): scope dari list_acceptance + sitelist_mt JSON.
 * withMtSc=false (DBX): hanya list_acceptance — jauh lebih cepat, Reserved tanpa LA bisa kurang ter-cover.
 */
const PATP_BASE_CTE = (withMtSc) => `with tx as materialized (select p.transaction_id, max(p.update_time) ut from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
    okx as materialized (select tx.transaction_id, tx.ut from tx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = tx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
    m as (select t.mps_transaction_id, max(nullif(t.vendor_code,'')) vc,
          ${DT('greatest(max(t.created_date), max(okx.ut))')} d
        from mps_transaction t join okx on okx.transaction_id = t.mps_transaction_id group by 1),
    sk as materialized (select distinct on (p.system_key) p.system_key, p.transaction_id
        from mapping_systemkey_po p join okx on okx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> ''
        order by p.system_key, p.update_time desc nulls last, p.transaction_id desc),
    mps_tx as materialized (
      select sk.system_key sk, m.vc v, m.d d from sk join m on m.mps_transaction_id = sk.transaction_id),
    txsk as materialized (select distinct system_key from mapping_systemkey_po
        where transaction_id is not null and transaction_id <> '' and system_key is not null),
    mps_res as materialized (
      select p.system_key sk, max(nullif(p.vendor_code,'')) v, ${DT('max(coalesce(p.update_time, p.create_time))')} d
      from mapping_systemkey_po p
      where p.status_id in (1,2) and ${IN_PO('p.po')} and p.system_key is not null and p.system_key <> ''
        and not exists (select 1 from txsk where txsk.system_key = p.system_key)
      group by p.system_key),
    mps_sk as materialized (select * from mps_tx union all select * from mps_res),
    la_sc as materialized (
      select distinct on (la.system_key) la.system_key, btrim(la.scope_category) as scope_category
      from list_acceptance la
      where la.system_key in (select sk from mps_sk) and coalesce(btrim(la.scope_category), '') <> ''
      order by la.system_key, la.create_time desc nulls last),
    sm_pt as materialized (
      select sm.system_key, sm.project_type from sitelist_mt sm
      where sm.system_key in (select sk from mps_sk)),
    ${withMtSc ? `mt_sc as materialized (
      select sm.system_key, nullif(btrim(sm.content_column -> 0 ->> 'scope_category'), '') as scope_category
      from sitelist_mt sm
      where sm.system_key in (select sk from mps_sk except select system_key from la_sc)
        and nullif(btrim(sm.content_column -> 0 ->> 'scope_category'), '') is not null),` : ''}
    mptc_n as materialized (select id, btrim(name) as nm from master_project_type_code),
    msa_n as materialized (select btrim(project_type) pt, btrim(scope_category) sc, fatp, patp from master_scope_acceptance),
    need as materialized (
      select m.sk, m.v, m.d,
        bool_or(coalesce(msa.fatp, false)) need_fatp,
        bool_or(coalesce(msa.patp, false)) need_patp
      from mps_sk m
      join sm_pt sm on sm.system_key = m.sk
      left join mptc_n mptc on mptc.id = sm.project_type
      ${withMtSc
        ? `left join la_sc on la_sc.system_key = m.sk
      left join mt_sc on mt_sc.system_key = m.sk
      left join msa_n msa
        on msa.pt = mptc.nm
       and msa.sc = coalesce(la_sc.scope_category, mt_sc.scope_category)`
        : `join la_sc on la_sc.system_key = m.sk
      left join msa_n msa
        on msa.pt = mptc.nm
       and msa.sc = la_sc.scope_category`}
      group by m.sk, m.v, m.d),
    fatp_need as materialized (select sk, v, d from need where need_fatp),
    patp_need as materialized (select sk, v, d from need where need_patp),
    latest_patp as materialized (
      select p.sk, coalesce(fa.an, p.an) an, p.v, p.d, coalesce(fa.st, p.st) st
      from (
        select distinct on (la.system_key)
          la.system_key sk, la.acceptance_number an, n.v, n.d, la.status st
        from list_acceptance la
        join patp_need n on n.sk = la.system_key
        where la.acceptance_number like 'PATP-%'
        order by la.system_key, coalesce(la.update_time, la.create_time) desc nulls last, la.acceptance_number desc) p
      left join lateral (
        select x.acceptance_number an, x.status st
        from list_acceptance x
        where x.system_key = p.sk and x.acceptance_number like 'PATP-%'
          and x.status like 'Acceptance Fully Approved%'
        order by coalesce(x.update_time, x.create_time) desc nulls last, x.acceptance_number desc
        limit 1) fa on true),
    latest_fatp as materialized (
      select distinct on (la.system_key)
        la.system_key sk, la.acceptance_number an, n.v, n.d, la.status st
      from list_acceptance la
      join fatp_need n on n.sk = la.system_key
      where la.acceptance_number like 'FATP-%'
      order by la.system_key, coalesce(la.update_time, la.create_time) desc nulls last, la.acceptance_number desc)`
// System key MPS (aturan sama dengan card MPS: transaksi scope Fusion tanpa PO legacy, transaksi terbaru per system key).
// nm = jumlah line MATERIAL (bukan service) di transaksi itu; a = Rp hanya line material. System key tanpa line material (service only) tidak dihitung.
// onlyMatc=true membatasi ke system key yang ada di BA MATC (lebih ringan). Berakhir di CTE `val`.
const MPS_SK_VAL = (onlyMatc) => `with tx as materialized (select p.transaction_id, max(p.update_time) ut from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
      okx as materialized (select tx.transaction_id, tx.ut from tx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = tx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
      sk as materialized (select distinct on (p.system_key) p.system_key, p.transaction_id
        from mapping_systemkey_po p join okx on okx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> ''${onlyMatc ? ' and p.system_key in (select x.system_key from material_certificate_details x where x.system_key is not null)' : ''}
        order by p.system_key, p.update_time desc nulls last, p.transaction_id desc),
      val as materialized (select sk.system_key, sk.transaction_id,
          count(*) filter (where not ${IS_SVC('p')}) nm,
          sum(case when not ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end) a
        from sk join mapping_systemkey_po p on p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
        left join lateral (select t.net_price::numeric np from transaction_po t where t.po_number = p.po and t.line_subline = p.material_line_item
            and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
          order by t.created_at desc, t.id desc limit 1) tp on true
        group by 1,2)`

// MATC per unique system key: 1 SK = 1 baris. Status = prioritas workflow lintas semua BA
// (completed > in_progress > rejected > none). Rp (a) = line material MPS (harga PO terbaru, IDR).
const MATC_SK = `select z.sk, z.d, coalesce(v.a, 0) a, z.wf from (
              select b.sk, ${DT('max(b.ts)')} d,
                case when bool_or(w.wf = 'completed') then 'completed'
                     when bool_or(w.wf = 'in_progress') then 'in_progress'
                     when bool_or(w.wf = 'rejected') then 'rejected'
                     else null end wf
              from (
                select mc.ba_number, dd.system_key sk,
                  max(coalesce(mc.updated_date, mc.created_date)) ts
                from material_certificates mc
                join material_certificate_details dd on dd.ba_number = mc.ba_number
                where ${BA_SCOPE('material_certificate_details', 'mc.ba_number')}
                  and dd.system_key is not null and dd.system_key <> ''
                group by mc.ba_number, dd.system_key) b
              left join lateral (select ${WF_LATEST('material_certificates', 'b.ba_number')} wf) w on true
              group by b.sk) z
            join (${MPS_SK_VAL(true)} select system_key, a from val where nm > 0) v on v.system_key = z.sk`

// ---------- Query: semua mengembalikan baris (v = vendor_code, s = status, n = jumlah, x = extra) ----------
/** PATP queries: pg = monolit 1× need CTE; DBX = pecah (atau di-skip). */
const PATP_QUERIES = (() => {
  const base = PATP_BASE_CTE(USE_PG)
  // Of-Y Rp: valuasi MPS/PO (semua line IDR) untuk universe patp_need (tx terbaru + Reserved/Ready).
  const scopeVal = `
    scope_tx as materialized (
      select sk.system_key sk,
        sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end) a
      from sk
      join patp_need n on n.sk = sk.system_key
      join mapping_systemkey_po p on p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
      left join lateral (select t.net_price::numeric np from transaction_po t
        where t.po_number = p.po and t.line_subline = p.material_line_item
          and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
        order by t.created_at desc, t.id desc limit 1) tp on true
      group by sk.system_key),
    scope_res as materialized (
      select p.system_key sk,
        sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end) a
      from mapping_systemkey_po p
      join patp_need n on n.sk = p.system_key
      left join lateral (select t.net_price::numeric np from transaction_po t
        where t.po_number = p.po and t.line_subline = p.material_line_item
          and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
        order by t.created_at desc, t.id desc limit 1) tp on true
      where p.status_id in (1,2) and ${IN_PO('p.po')}
        and not exists (select 1 from txsk where txsk.system_key = p.system_key)
      group by p.system_key),
    scope_val as materialized (
      select sk, a from scope_tx
      union all
      select sk, a from scope_res)`
  const pvLatest = `
    l as materialized (
      select s.acceptance_number, s.po_number, s.line_item, s.mapping_po_sk_quantity
        from service_powo_acceptance s where s.acceptance_number in (select an from latest_patp)
      union all
      select m.acceptance_number, m.po_number, m.line_item, m.mapping_po_sk_quantity
        from material_acceptance m where m.acceptance_number in (select an from latest_patp)),
    mp as materialized (select distinct on (po, material_line_item, system_key) po, material_line_item, system_key, quanty_mapping
      from mapping_systemkey_po where po in (select po_number from l) order by po, material_line_item, system_key, id desc),
    pv as materialized (
      select lp.sk, sum(
          case when l.mapping_po_sk_quantity ~ ${NUM_RE} then least(l.mapping_po_sk_quantity::numeric,
                case when mp.quanty_mapping::text ~ ${NUM_RE} then mp.quanty_mapping::numeric else l.mapping_po_sk_quantity::numeric end) end
          * case when tp.net_price ~ ${NUM_RE} then tp.net_price::numeric end) a
        from latest_patp lp
        join l on l.acceptance_number = lp.an
        left join mp on mp.po = l.po_number and mp.material_line_item = l.line_item and mp.system_key = lp.sk
        join lateral (select t.net_price, t.currency from transaction_po t
          where t.po_number = l.po_number and t.line_subline = l.line_item
          order by t.created_at desc, t.id desc limit 1) tp on true
        where upper(trim(coalesce(tp.currency,''))) = 'IDR'
        group by lp.sk)`
  // Funnel Rp = MPS PO mapping (qty x latest IDR net price) scoped ke Fully Approved PATP saja
  // (ringan: hanya SK di `b`). GI = material, GR Service = service, FA = material+service.
  // Card PATP utama tetap pakai pv (Current Realisation acceptance).
  const funnelTail = `
    b as materialized (select sk, an, v, d, st from latest_patp where st like 'Acceptance Fully Approved%'),
    mps_funnel_val as materialized (
      select sk.system_key sk,
        coalesce(sum(case when not ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0) a_mat,
        coalesce(sum(case when ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0) a_svc,
        coalesce(sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0) a_all
      from sk
      join b on b.sk = sk.system_key
      join mapping_systemkey_po p on p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
      left join lateral (select t.net_price::numeric np from transaction_po t
        where t.po_number = p.po and t.line_subline = p.material_line_item
          and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
        order by t.created_at desc, t.id desc limit 1) tp on true
      group by sk.system_key
      union all
      select p.system_key sk,
        coalesce(sum(case when not ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0),
        coalesce(sum(case when ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0),
        coalesce(sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0)
      from mapping_systemkey_po p
      join b on b.sk = p.system_key
      left join lateral (select t.net_price::numeric np from transaction_po t
        where t.po_number = p.po and t.line_subline = p.material_line_item
          and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
        order by t.created_at desc, t.id desc limit 1) tp on true
      where p.status_id in (1,2) and ${IN_PO('p.po')}
        and not exists (select 1 from sk where sk.system_key = p.system_key)
      group by p.system_key),
    b_an as materialized (
      select distinct la.system_key sk, la.acceptance_number an
      from list_acceptance la
      where la.acceptance_number like 'PATP-%'
        and la.status like 'Acceptance Fully Approved%'
        and la.system_key in (select sk from b)),
    gi_i as materialized (
      select i.id, i.system_key sk from oracle_fusion_intinv_006_interface i
      where coalesce(i.export_status,'') <> 'GATE_FILTERED' and i.system_key in (select sk from b)),
    gi_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_006_ack a where a.interface_id_ref in (select id from gi_i)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    gi_agg as materialized (
      select i.sk, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from gi_i i left join gi_ack k on k.interface_id_ref = i.id group by i.sk),
    -- Interface di-materialize sekali; OR / regexp diganti UNION equality join (hash join, hasil sama).
    gr_src as materialized (
      select i.id, i.acceptance_number an, i.ba_reference br
      from oracle_fusion_intinv_005_interface i
      where coalesce(i.file_type,'') ilike 'service%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    gr_i as materialized (
      select g.id, ba.sk from b_an ba join gr_src g on g.an = ba.an
      union
      select g.id, ba.sk from b_an ba join gr_src g on g.br = ba.an),
    gr_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_005_ack a where a.interface_id_ref in (select id from gr_i)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    gr_agg as materialized (
      select i.sk, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from gr_i i left join gr_ack k on k.interface_id_ref = i.id group by i.sk),
    fa_src as materialized (
      select i.id, i.receipt_number rn, regexp_replace(i.receipt_number, '_[0-9]+$', '') rs
      from oracle_fusion_intppm_002_interface i
      where i.receipt_number like 'PATP-%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    fa as materialized (
      select f.id, ba.sk from b_an ba join fa_src f on f.rn = ba.an
      union
      select f.id, ba.sk from b_an ba join fa_src f on f.rs = ba.an),
    fa_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intppm_002_ack a where a.interface_id_ref in (select id from fa)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    fl as materialized (
      select f.sk, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from fa f left join fa_ack k on k.interface_id_ref = f.id group by f.sk)`
  const coreSelect = `
    select 'patp' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select lp.v, lp.st s, lp.d, coalesce(pv.a, 0) a
      from latest_patp lp left join pv on pv.sk = lp.sk) y group by 2,3,4
    union all select 'fatp' k, v, s, d, count(*) n, 0::bigint a from (
      select lf.v, lf.st s, lf.d from latest_fatp lf) z group by 2,3,4
    union all select 'fatpScope' k, v, 'Required' s, d, count(*) n, 0::bigint a from fatp_need group by v, d
    union all select 'patpScope' k, v, 'Required' s, d, count(*) n, coalesce(sum(a), 0)::bigint a from (
      select n.v, n.d, coalesce(sv.a, 0) a from patp_need n left join scope_val sv on sv.sk = n.sk) z group by v, d`
  const funnelSelect = `
    select 'patpGi' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, coalesce(mv.a_mat, 0) a, ${FUNNEL_STATUS} s
      from b left join mps_funnel_val mv on mv.sk = b.sk left join gi_agg g on g.sk = b.sk) x group by 2,3,4
    union all select 'patpGr' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, coalesce(mv.a_svc, 0) a, ${FUNNEL_STATUS} s
      from b left join mps_funnel_val mv on mv.sk = b.sk left join gr_agg g on g.sk = b.sk) x group by 2,3,4
    union all select 'patpFa' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, coalesce(mv.a_all, 0) a, ${FUNNEL_STATUS} s
      from b left join mps_funnel_val mv on mv.sk = b.sk left join fl g on g.sk = b.sk) x group by 2,3,4`
  // Query ringan of-Y saja (jalan di DBX meski patpAll di-skip).
  // Pakai withMtSc=true agar universe of-Y sama dengan jalur pg (~100rb; include Reserved via sitelist_mt).
  const patpScopeVal = `${PATP_BASE_CTE(true)},${scopeVal}
    select v, 'Required' s, d, count(*) n, coalesce(sum(a), 0)::bigint a from (
      select n.v, n.d, coalesce(sv.a, 0) a from patp_need n left join scope_val sv on sv.sk = n.sk) z group by v, d`
  // Core vs funnel dipisah (PG + DBX): monolit patpAll sering >5 mnt + timeout saat
  // berebut CPU dengan fusion/cac. Data sama — digabung di part() setelah query.
  return {
    patpAll: `${base},${scopeVal},${pvLatest}
    ${coreSelect}`,
    // Fallback of-Y bila SANITATION_ONLY=patpScopeVal / patpAll di-skip di DBX.
    patpScopeVal,
    patpFunnel: `${base},
    ${funnelTail}
    ${funnelSelect}`,
  }
})()

/**
 * Universe system key Page 2 = SAMA dengan card MPS Page 1 (transaksi MPS bersih Fusion):
 * transaksi yang punya PO di luar scope dikeluarkan; 1 system key = transaksi terbaru-nya.
 * Dipakai semua card Netgear supaya angkanya bisa dibandingkan langsung dengan Page 1.
 * Kolom: sk, vc (vendor transaksi), ut (modified, untuk tanggal bila belum ada baris Netgear).
 */
const MPS_UNIVERSE_CTE = `mtx as materialized (select p.transaction_id, max(p.update_time) ut from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
      mokx as materialized (select mtx.transaction_id, mtx.ut from mtx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = mtx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
      msk as materialized (select distinct on (p.system_key) p.system_key, p.transaction_id
        from mapping_systemkey_po p join mokx on mokx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> ''
        order by p.system_key, p.update_time desc nulls last, p.transaction_id desc),
      uni as materialized (
        select msk.system_key sk, mokx.ut,
          (select max(nullif(t.vendor_code,'')) from mps_transaction t where t.mps_transaction_id = msk.transaction_id) vc,
          coalesce((select ms.name = 'MPS Fully Approved' from mps_transaction t
              left join mps_status ms on ms.id = t.status_approval
            where t.mps_transaction_id = msk.transaction_id order by t.id desc limit 1), false) fa
        from msk join mokx on mokx.transaction_id = msk.transaction_id
        where exists (select 1 from mps_transaction t where t.mps_transaction_id = msk.transaction_id)
          and exists (select 1 from mapping_systemkey_po p where p.system_key = msk.system_key
            and p.transaction_id = msk.transaction_id and p.quanty_mapping ~ ${NUM_RE}))`

/**
 * Tagging MOS/GREEN + overlay ACK MPS Approved (rollup sama card MPS Approved).
 * Status normal hanya untuk key yang ACK Success; selain itu Anomaly:* supaya
 * angka besar card = tagging ∩ ACK Success, anomali tetap terlihat.
 * GREEN: map PO+line → system key (task tidak membawa system_key).
 */
const NETGEAR_TAGGING_WITH_MPS_ACK = (type) => `with ${MPS_UNIVERSE_CTE},
    ${type === 'GREEN'
  ? `task as materialized (
      select distinct on (coalesce(t.task_id,''), coalesce(t.activity_counter,''))
        t.po_number po, t.po_line_item li, coalesce(nullif(t.task_status_normalized,''), 'Unknown') st,
        coalesce(t.task_last_update, t.received_at, t.task_date::timestamptz) ts
      from netgear_task_tagging t
      where t.task_type = 'GREEN' and t.po_number is not null and t.po_number <> '' and ${IN_PO('t.po_number')}
      order by coalesce(t.task_id,''), coalesce(t.activity_counter,''),
        coalesce(t.task_last_update, t.received_at, t.task_date::timestamptz) desc nulls last, t.id desc),
    latest as materialized (
      select mp.system_key sk, k.st, k.ts
      from task k
      join (select distinct po, material_line_item, system_key from mapping_systemkey_po
            where system_key in (select sk from uni)) mp
        on mp.po = k.po and mp.material_line_item = k.li)`
  : `latest as materialized (
      select distinct on (t.system_key, coalesce(t.task_id,''))
        t.system_key sk, coalesce(nullif(t.task_status_normalized,''), 'Unknown') st,
        coalesce(t.task_last_update, t.received_at, t.task_date::timestamptz) ts
      from netgear_task_tagging t
      where t.task_type = '${type}' and t.system_key in (select sk from uni)
      order by t.system_key, coalesce(t.task_id,''),
        coalesce(t.task_last_update, t.received_at, t.task_date::timestamptz) desc nulls last, t.id desc)`},
    per_sk as materialized (
      select distinct on (sk) sk, st, ts from latest
      order by sk, (case when st = 'Fully Approved' then 2 when st = 'Cancelled' then 3 else 1 end), ts desc nulls last),
    exp_latest as materialized (
      select distinct on (r.system_key, coalesce(r.transaction_id,''), coalesce(r.po,''), coalesce(r.material_line_item,''))
        r.system_key sk, r.ack_status
      from netgear_mps_approved_rows r
      left join netgear_upload_logs u on u.id = r.upload_log_id
      where r.superseded_at is null and r.system_key in (select sk from per_sk)
        and coalesce(u.file_name,'') not ilike 'backfill%'
      order by r.system_key, coalesce(r.transaction_id,''), coalesce(r.po,''), coalesce(r.material_line_item,''),
        r.exported_at desc nulls last, r.id desc),
    exp_agg as materialized (
      select sk, count(*) lines,
        count(*) filter (where lower(coalesce(ack_status,'')) in ('true','t','1','success')) ok,
        count(*) filter (where lower(coalesce(ack_status,'')) in ('false','f','0','error')) err
      from exp_latest group by sk)
    select v, s, d, count(*) n from (
      select coalesce(u.vc, ${VENDOR_BY_SYSTEM_KEY('g.sk')}) v, ${DT('g.ts')} d,
        case
          when e.sk is null then 'Anomaly: ${type} without MPS export'
          when e.err > 0 then 'Anomaly: ${type} without MPS ACK Success (ACK Error)'
          when e.ok = e.lines then g.st
          else 'Anomaly: ${type} without MPS ACK Success (Waiting ACK MPS)'
        end s
      from per_sk g
      join uni u on u.sk = g.sk
      left join exp_agg e on e.sk = g.sk) x group by 1,2,3`

const Q = {
  // Hanya system key yang SUDAH punya MPS (set sama dengan card MPS); yang belum punya MPS tidak dihitung.
  // 1 system key = 1 baris (unik global). Punya baseline = modul baseline ATAU header *_bf terisi di sitelist_mt.
  // Prioritas status: modul Baseline terbaru (update_time/create_time, tie-break baseline_id); MT-only = Has BF on Master tracker.
  // baseline.po_number sering CSV multi-PO: masuk modul bila minimal 1 PO Fusion (po kosong/null tidak masuk).
  // Scan MT dibatasi mpssk agar ringan. x = jumlah project pembawa (hanya dari modul; MT-only tidak menambah).
  baseline: `with tx as materialized (select p.transaction_id from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
      okx as materialized (select tx.transaction_id from tx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = tx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
      mpssk as materialized (select distinct p.system_key from mapping_systemkey_po p join okx on okx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> ''),
      from_module as materialized (
        select sk, baseline_id, v, s, d from (
          select k.v as sk, b.baseline_id::text as baseline_id, nullif(b.vendor_code,'')::text v,
            regexp_replace(b.baseline_status, '\\s*:.*$', '')::text s,
            ${DT('coalesce(b.update_time, b.create_time)')} d,
            row_number() over (partition by k.v order by coalesce(b.update_time, b.create_time) desc nulls last, b.baseline_id desc) rn
          from baseline b cross join lateral json_array_elements_text(b.system_key) k(v)
          where json_typeof(b.system_key) = 'array' and k.v <> ''
            and k.v in (select system_key from mpssk)
            and exists (
              select 1 from regexp_split_to_table(coalesce(b.po_number, ''), '\\s*,\\s*') as x(po)
              where nullif(btrim(x.po), '') in (select po from scope_po))) z
        where rn = 1),
      from_mt_bf as materialized (
        select m.system_key as sk
        from mpssk m
        join sitelist_mt sm on sm.system_key = m.system_key
        where exists (
          select 1
          from jsonb_array_elements(
            case
              when sm.content_column is null then '[]'::jsonb
              when jsonb_typeof(sm.content_column::jsonb) = 'array' then sm.content_column::jsonb
              when jsonb_typeof(sm.content_column::jsonb) = 'object' then jsonb_build_array(sm.content_column::jsonb)
              else '[]'::jsonb
            end) obj
          cross join lateral jsonb_each(
            case when jsonb_typeof(obj) = 'object' then obj else '{}'::jsonb end) e(k, val)
          where e.k ilike '%\\_bf%' escape '\\'
            and nullif(btrim(e.val #>> '{}'), '') is not null)),
      mt_only as materialized (
        select bf.sk, null::text as baseline_id, max(nullif(p.vendor_code,''))::text as v,
          'Has BF on Master tracker'::text as s,
          ${DT('max(coalesce(p.update_time, p.create_time))')} as d
        from from_mt_bf bf
        join mapping_systemkey_po p on p.system_key = bf.sk
        where not exists (select 1 from from_module fm where fm.sk = bf.sk)
        group by bf.sk),
      merged as (
        select sk, baseline_id, v, s, d from from_module
        union all
        select sk, baseline_id, v, s, d from mt_only)
    select v, s, d, count(*) n, count(distinct baseline_id) x from merged group by 1,2,3`,

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
        from mps_transaction t join m using (mps_transaction_id) order by t.mps_transaction_id, t.id desc),
      sk as materialized (select distinct on (p.system_key) p.system_key, p.transaction_id
        from mapping_systemkey_po p join okx on okx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> ''
        order by p.system_key, p.update_time desc nulls last, p.transaction_id desc),
      val as materialized (select sk.system_key, sk.transaction_id,
          sum(p.quanty_mapping::numeric * tp.np) a,
          sum(case when ${IS_SVC('p')} then p.quanty_mapping::numeric * tp.np end) a_svc
        from sk join mapping_systemkey_po p on p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
        left join lateral (select t.net_price::numeric np from transaction_po t where t.po_number = p.po and t.line_subline = p.material_line_item
            and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
          order by t.created_at desc, t.id desc limit 1) tp on true
        where p.quanty_mapping ~ ${NUM_RE} group by 1,2)
    select m.vc v, coalesce(ms.name, 'Status ' || b.status_approval) s, m.d d, count(*) n,
      coalesce(sum(val.a), 0)::bigint a, coalesce(sum(val.a_svc), 0)::bigint a_svc
    from val join b on b.mps_transaction_id = val.transaction_id
    join m on m.mps_transaction_id = val.transaction_id
    left join mps_status ms on ms.id = b.status_approval
    group by 1,2,3`,

  // Penyebut "of Y" card MATC: system key dengan >= 1 line material (service only tidak dihitung),
  // termasuk Reserved/Ready yang belum punya transaksi MPS (selaras total MPS gabungan di UI).
  // Rp (a) = line material saja (qty x latest PO net price IDR).
  mpsMaterial: `${MPS_SK_VAL(false)},
      m as (select t.mps_transaction_id, max(nullif(t.vendor_code,'')) vc,
          ${DT('greatest(max(t.created_date), max(okx.ut))')} d
        from mps_transaction t join okx on okx.transaction_id = t.mps_transaction_id group by 1),
      b as (select distinct on (t.mps_transaction_id) t.mps_transaction_id, t.status_approval
        from mps_transaction t join m using (mps_transaction_id) order by t.mps_transaction_id, t.id desc),
      tx_mat as (
        select m.vc v, coalesce(ms.name, 'Status ' || b.status_approval) s, m.d d, count(*) n,
          coalesce(sum(val.a), 0)::bigint a
        from val join b on b.mps_transaction_id = val.transaction_id
        join m on m.mps_transaction_id = val.transaction_id
        left join mps_status ms on ms.id = b.status_approval
        where val.nm > 0
        group by 1,2,3),
      txsk as materialized (select distinct system_key from mapping_systemkey_po
        where transaction_id is not null and transaction_id <> '' and system_key is not null),
      res_mat as (
        select v, 'Reserved/Ready' s, d, count(*) n, coalesce(sum(a), 0)::bigint a from (
          select max(nullif(p.vendor_code,'')) v, ${DT('max(coalesce(p.update_time, p.create_time))')} d,
            sum(case when not ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end) a
          from mapping_systemkey_po p
          left join lateral (select t.net_price::numeric np from transaction_po t where t.po_number = p.po and t.line_subline = p.material_line_item
              and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
            order by t.created_at desc, t.id desc limit 1) tp on true
          where p.status_id in (1,2) and ${IN_PO('p.po')} and p.system_key is not null and p.system_key <> ''
            and not exists (select 1 from txsk where txsk.system_key = p.system_key)
          group by p.system_key
          having count(*) filter (where not ${IS_SVC('p')}) > 0) x
        group by 1,3)
    select * from tx_mat
    union all
    select * from res_mat`,

  // Site Transfer (INTINV-007): universe = done export ∪ antrian scheduler PMIS
  // (findMosReadyUnexportedKeys: Current≠Destination, MOS AF, Fusion PO, bukan migrasi AUC).
  // Not Sent = antrian penuh (belum export ATAU dest berubah); Sent/ACK = export & tidak di antrian.
  siteTransfer: `with ${MIG_SK_CTE}
    fusion_line as materialized (
      select distinct tp.po_number po, tp.line_subline li
      from transaction_po tp
      where tp.sync_source in ('fusion','sap-fusion')
        and tp.po_number in (select po from scope_po)
    ),
    moving as materialized (
      select distinct m.system_key sk, m.po, nullif(trim(m.mps_id),'') mps_id,
        trim(m.material_line_item) li, trim(m.destination_subtask) dest,
        nullif(m.vendor_code,'') vc,
        case when m.quanty_mapping ~ ${NUM_RE} then m.quanty_mapping::numeric end qty
      from mapping_systemkey_po m
      join scope_po sp on sp.po = m.po
      join fusion_line fl on fl.po = m.po and fl.li = trim(m.material_line_item)
      where m.system_key is not null and m.system_key <> ''
        and nullif(trim(m.current_subtask),'') is not null
        and nullif(trim(m.destination_subtask),'') is not null
        and trim(m.current_subtask) <> trim(m.destination_subtask)
        and not exists (select 1 from mig_sk x where x.sk = m.system_key)
    ),
    mos as materialized (
      select distinct sm.system_key sk
      from sitelist_mt sm
      where sm.system_key in (select distinct sk from moving)
        and nullif(btrim(sm.content_column -> 0 ->> 'mos_af'), '') is not null
        and nullif(btrim(sm.content_column -> 0 ->> 'mos_af'), '-') is not null
    ),
    moving_mos as materialized (
      select m.* from moving m join mos on mos.sk = m.sk
    ),
    -- Eligibility (PMIS): semua baris non-ERROR, termasuk GATE_FILTERED.
    sent_elig as materialized (
      select nullif(trim(i.mps_id),'') mps_id,
        nullif(trim(i.transaction_reference_oracle),'') xref,
        trim(i.po) po, trim(i.material_line_item) li,
        nullif(trim(i.transfer_inv_task_oracle),'') dest,
        i.created_at ct
      from oracle_fusion_intinv_007_interface i
      where i.record_status is null or i.record_status <> 'ERROR'
    ),
    -- Card Sent/ACK: baris export nyata (bukan GATE_FILTERED).
    sent007 as materialized (
      select i.id, nullif(trim(i.mps_id),'') mps_id,
        nullif(trim(i.transaction_reference_oracle),'') xref,
        trim(i.po) po, trim(i.material_line_item) li,
        i.quantity_gi q, i.created_at ct
      from oracle_fusion_intinv_007_interface i
      where coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and (i.record_status is null or i.record_status <> 'ERROR')
    ),
    sent_mps as materialized (
      select distinct mps_id, po, li from sent_elig where mps_id is not null
    ),
    sent_ref as materialized (
      select distinct xref, po, li from sent_elig where xref is not null
    ),
    last_dest_mps as materialized (
      select distinct on (mps_id, po, li) mps_id, po, li, dest
      from sent_elig where mps_id is not null and dest is not null
      order by mps_id, po, li, ct desc nulls last
    ),
    last_dest_ref as materialized (
      select distinct on (xref, po, li) xref, po, li, dest
      from sent_elig where xref is not null and dest is not null
      order by xref, po, li, ct desc nulls last
    ),
    needy as materialized (
      select mm.sk, mm.vc, mm.po, mm.li, mm.qty
      from moving_mos mm
      left join sent_mps sm on sm.mps_id = mm.mps_id and sm.po = trim(mm.po) and sm.li = mm.li
      left join sent_ref sr on sr.xref = mm.sk and sr.po = trim(mm.po) and sr.li = mm.li
      left join last_dest_mps ldm on ldm.mps_id = mm.mps_id and ldm.po = trim(mm.po) and ldm.li = mm.li
      left join last_dest_ref ldr on ldr.xref = mm.sk and ldr.po = trim(mm.po) and ldr.li = mm.li
      where not (
        (sm.mps_id is not null or sr.xref is not null)
        and (
          (ldm.dest is not null and ldm.dest = mm.dest)
          or (ldr.dest is not null and ldr.dest = mm.dest)
        )
      )
    ),
    -- Antrian scheduler PMIS (findMosReadyUnexportedKeys, tanpa limit/rotasi).
    waiting_sk as materialized (
      select n.sk, max(n.vc) vc from needy n group by n.sk
    ),
    sent_sk as materialized (
      select distinct mp.system_key sk
      from sent007 i
      join mapping_systemkey_po mp on mp.mps_id = i.mps_id
      where mp.system_key is not null and mp.system_key <> ''
        and ${IN_PO('mp.po')}
      union
      select distinct xref from sent007
      where xref is not null and xref in (select sk from moving)
    ),
    -- Sent card = sudah export & tidak lagi di antrian (hindari dobel hitung).
    done_sk as materialized (
      select s.sk from sent_sk s
      where s.sk not in (select sk from waiting_sk)
    ),
    po_price as materialized (
      select distinct on (t.po_number, t.line_subline)
        t.po_number po, t.line_subline li, t.net_price::numeric np
      from transaction_po t
      where t.po_number in (
          select distinct po from needy
          union
          select distinct po from sent007
        )
        and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
      order by t.po_number, t.line_subline, t.created_at desc nulls last, t.id desc
    ),
    wait_val as materialized (
      select n.sk, coalesce(sum(n.qty * pp.np), 0) a,
        to_char(current_date, 'YYYY-MM-DD') d
      from needy n
      left join po_price pp on pp.po = n.po and pp.li = n.li
      group by n.sk
    ),
    st_line as materialized (
      select distinct on (mp.system_key, i.po, i.li)
        i.id, mp.system_key sk, i.po, i.li, i.q, i.ct
      from sent007 i
      join mapping_systemkey_po mp on mp.mps_id = i.mps_id
      where mp.system_key in (select sk from done_sk)
      order by mp.system_key, i.po, i.li, i.id desc
    ),
    st_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_007_ack a where a.interface_id_ref in (select id from st_line)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc
    ),
    st_agg as materialized (
      select l.sk, count(*) lines,
        count(*) filter (where k.ack_status = 'SUCCESS') ok,
        count(*) filter (where k.ack_status = 'ERROR') err,
        sum(case when l.q::text ~ ${NUM_RE} then l.q::numeric * pp.np end) a,
        ${DT('max(l.ct)')} d
      from st_line l
      left join st_ack k on k.interface_id_ref = l.id
      left join po_price pp on pp.po = l.po and pp.li = l.li
      group by l.sk
    ),
    vendor_sk as materialized (
      select p.system_key sk, max(nullif(p.vendor_code,'')) v
      from mapping_systemkey_po p
      where p.system_key in (select sk from done_sk) and ${IN_PO('p.po')}
      group by p.system_key
    ),
    u as materialized (
      select sk.sk, vs.v,
        coalesce(g.d, to_char(current_date, 'YYYY-MM-DD')) d,
        coalesce(g.a, 0) a,
        case when g.lines is null then 'Waiting ACK'
             when g.err > 0 then 'ACK Error'
             when g.ok = g.lines then 'ACK Success'
             else 'Waiting ACK' end as st
      from done_sk sk
      left join st_agg g on g.sk = sk.sk
      left join vendor_sk vs on vs.sk = sk.sk
      union all
      select w.sk, w.vc, coalesce(wv.d, to_char(current_date, 'YYYY-MM-DD')), coalesce(wv.a, 0), 'Not Sent'
      from waiting_sk w
      left join wait_val wv on wv.sk = w.sk
    )
    select v, st as s, d, count(*) n, coalesce(sum(a), 0)::bigint a from u group by 1,2,3`,

  // Reserved/Ready: 1 system key = 1 baris (unik global). System key yang sudah punya transaksi MPS dikeluarkan.
  // Rp = sum(quanty_mapping x net_price PO terbaru, IDR) semua line; a_svc = service lines only (untuk of-Y CAC).
  mpsReserved: `with txsk as materialized (select distinct system_key from mapping_systemkey_po
      where transaction_id is not null and transaction_id <> '' and system_key is not null)
    select v, 'Reserved/Ready' s, d, count(*) n, coalesce(sum(a), 0)::bigint a, coalesce(sum(a_svc), 0)::bigint a_svc from (
      select max(nullif(p.vendor_code,'')) v, ${DT('max(coalesce(p.update_time, p.create_time))')} d,
        sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end) a,
        sum(case when ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end) a_svc
      from mapping_systemkey_po p
      left join lateral (select t.net_price::numeric np from transaction_po t where t.po_number = p.po and t.line_subline = p.material_line_item
              and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
            order by t.created_at desc, t.id desc limit 1) tp on true
      where p.status_id in (1,2) and ${IN_PO('p.po')} and p.system_key is not null and p.system_key <> ''
        and not exists (select 1 from txsk where txsk.system_key = p.system_key)
      group by p.system_key) x group by 1,3`,

  matc: `select v, s, d, count(*) n, sum(a)::bigint a from (
      select ${VENDOR_BY_SYSTEM_KEY('m.sk')} v,
        case m.wf when 'completed' then 'Fully Approved' when 'in_progress' then 'In Progress'
          when 'rejected' then 'Rejected' else 'No Workflow' end s,
        m.d d, m.a a
      from (${MATC_SK}) m) x group by 1,2,3`,

  // GR Material (INTINV-005): basis = unique SK Fully Approved (prioritas workflow).
  // Match material files across ALL completed BAs for that SK (bukan BA terbaru saja); ACK digabung per SK.
  // Line GATE_FILTERED / GR-rejected tidak dihitung.
  matcGr: `with fa as materialized (select sk, d, a from (${MATC_SK}) m where m.wf = 'completed'),
    fa_ba as materialized (
      select distinct b.ba, b.sk from (
        select mc.ba_number ba, dd.system_key sk
        from material_certificates mc
        join material_certificate_details dd on dd.ba_number = mc.ba_number
        where ${BA_SCOPE('material_certificate_details', 'mc.ba_number')}
          and dd.system_key is not null and dd.system_key <> ''
        group by mc.ba_number, dd.system_key) b
      where b.sk in (select sk from fa)
        and ${WF_LATEST('material_certificates', 'b.ba')} = 'completed'),
    lines as materialized (
      select fb.sk, i.id, i.export_status
      from oracle_fusion_intinv_005_interface i
      join fa_ba fb on fb.ba = i.ba_number
      where coalesce(i.file_type,'') not ilike 'service%'
        and coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and not exists (select 1 from material_certificate_details rej where rej.ba_number = i.ba_number
          and rej.line_item = i.line_item::text and rej.gr_rejected_at is not null)),
    ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_005_ack a where a.interface_id_ref in (select id from lines)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    g as materialized (
      select l.sk, count(*) lines,
        count(*) filter (where l.export_status = 'EXPORTED' or k.ack_status is not null) sent,
        count(*) filter (where k.ack_status = 'SUCCESS') ok,
        count(*) filter (where k.ack_status = 'ERROR') err
      from lines l left join ack k on k.interface_id_ref = l.id
      group by l.sk)
    select v, s, d, count(*) n, sum(a)::bigint a from (
      select ${VENDOR_BY_SYSTEM_KEY('f.sk')} v, f.d d, f.a a,
        case when g.sk is null then 'Not Sent' when g.err > 0 then 'ACK Error'
             when g.ok = g.lines then 'ACK Success' when g.sent > 0 then 'Waiting ACK' else 'Not Sent' end s
      from fa f left join g on g.sk = f.sk) x group by 1,2,3`,

  // PATP: di pg = 1 query monolit (need CTE sekali). Di DBX default di-skip (lihat SKIP_PATP_ON_DBX).
  ...PATP_QUERIES,

  // CAC: 1 system key = 1. Status = prioritas workflow lintas semua BA
  // (completed > in_progress > rejected > none). Rp dari BA preferensi (rank sama).
  // Funnel GR/FA: basis SK Fully Approved; match interface ke semua BA completed milik SK.
  // Rp = realisation Appendix 2 SERVICE lines only (IS_SVC); material excluded.
  // SK tanpa line service tetap dihitung (n) dengan a = 0.
  cacAll: `with scoped_ba as materialized (
      select ba from (
        select x.ba_number ba,
          bool_or(${IN_PO('x.po_number')}) has_in,
          bool_or(x.po_number is not null and x.po_number not in (select po from scope_po)) has_out
        from acceptance_certificate_detail x group by 1) t
      where has_in and not has_out),
    ba_sk_all as materialized (
      select distinct d.system_key sk, h.ba_number ba, nullif(h.vendor_code,'') v,
        coalesce(h.updated_at, h.created_at) ts
      from acceptance_certificate_detail d
      join scoped_ba s on s.ba = d.ba_number
      join acceptance_certificate_header h on h.ba_number = d.ba_number
      where d.system_key is not null and d.system_key <> ''),
    wf as materialized (
      select distinct on (w.entity_id) w.entity_id ba, w.status wf
      from workflow_instances w
      where w.entity_type = 'acceptance_certificates' and w.entity_id in (select ba from ba_sk_all)
      order by w.entity_id, w.version desc, w.id desc),
    sk_status as materialized (
      select b.sk, max(b.v) v, ${DT('max(b.ts)')} d,
        case when bool_or(w.wf = 'completed') then 'completed'
             when bool_or(w.wf = 'in_progress') then 'in_progress'
             when bool_or(w.wf = 'rejected') then 'rejected'
             else null end wf
      from ba_sk_all b left join wf w on w.ba = b.ba
      group by b.sk),
    preferred as materialized (
      select distinct on (b.sk) b.sk, b.ba
      from ba_sk_all b left join wf w on w.ba = b.ba
      order by b.sk,
        case w.wf when 'completed' then 0 when 'in_progress' then 1 when 'rejected' then 2 else 3 end,
        b.ts desc nulls last, b.ba desc),
    det as materialized (
      select d.id, p.sk, d.mapping_id, d.po_number, d.line_item, d.network_header
      from preferred p
      join acceptance_certificate_detail d on d.ba_number = p.ba and d.system_key = p.sk),
    mp as materialized (
      select d.id, m.quanty_mapping, m.po, m.material_line_item
      from det d join mapping_systemkey_po m on m.id = d.mapping_id
      where d.mapping_id is not null and ${IS_SVC('m')}
      union all
      select * from (
        select distinct on (d.id) d.id, m.quanty_mapping, m.po, m.material_line_item
        from det d
        join mapping_systemkey_po m on m.po = d.po_number and m.material_line_item = d.line_item
          and m.system_key = d.sk and m.network_header is not distinct from d.network_header
        where d.mapping_id is null and ${IS_SVC('m')}
        order by d.id, m.id desc) f),
    tp as materialized (
      select distinct on (t.po_number, t.line_subline) t.po_number, t.line_subline, t.net_price
      from transaction_po t
      join (select distinct po, material_line_item from mp) k
        on k.po = t.po_number and k.material_line_item = t.line_subline
      where upper(trim(coalesce(t.currency,''))) = 'IDR'
      order by t.po_number, t.line_subline, t.created_at desc, t.id desc),
    sk_val as materialized (
      select d.sk, coalesce(sum(
          case when mp.quanty_mapping ~ ${NUM_RE} then mp.quanty_mapping::numeric end
          * case when tp.net_price ~ ${NUM_RE} then tp.net_price::numeric end), 0)::bigint a
      from det d
      join mp on mp.id = d.id
      join tp on tp.po_number = mp.po and tp.line_subline = mp.material_line_item
      group by d.sk),
    latest_cac as materialized (
      select s.sk, s.v, s.d, coalesce(sv.a, 0) a, s.wf
      from sk_status s
      left join sk_val sv on sv.sk = s.sk),
    b as materialized (select sk, v, d, a from latest_cac where wf = 'completed'),
    ba_done as materialized (
      select distinct bsa.ba
      from ba_sk_all bsa
      join wf on wf.ba = bsa.ba and wf.wf = 'completed'
      where bsa.sk in (select sk from b)),
    ba_sk as materialized (
      select distinct d.ba_number ba, d.system_key sk from acceptance_certificate_detail d
      where d.ba_number in (select ba from ba_done) and d.system_key is not null and d.system_key <> ''),
    ba_po as materialized (
      select distinct d.ba_number ba, d.po_number po from acceptance_certificate_detail d
      where d.ba_number in (select ba from ba_done) and d.po_number is not null),
    ba_patp as materialized (
      select distinct bs.ba, la.acceptance_number an from ba_sk bs
      join list_acceptance la on la.system_key = bs.sk and la.acceptance_category = 'PATP'),
    gr_i as materialized (
      select i.id, nullif(trim(i.system_key),'') sk, i.po_numbers po, i.acceptance_number an, i.ba_reference br
      from oracle_fusion_intinv_005_interface i
      where coalesce(i.file_type,'') ilike 'service%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    gr_match as materialized (
      select distinct i.id, bp.ba, i.an
      from gr_i i join ba_sk bs on bs.sk = i.sk join ba_po bp on bp.ba = bs.ba and bp.po = i.po
      union
      select distinct i.id, p.ba, i.an from gr_i i join ba_patp p on i.an = p.an
      union
      select distinct i.id, p.ba, i.an from gr_i i join ba_patp p on i.br = p.an
      union
      select distinct i.id, bd.ba, i.an from gr_i i join ba_done bd on i.an = bd.ba where i.sk is null
      union
      select distinct i.id, bd.ba, i.an from gr_i i join ba_done bd on i.br = bd.ba where i.sk is null),
    gr_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_005_ack a where a.interface_id_ref in (select id from gr_match)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    gr_agg as materialized (
      select bs.sk, count(distinct g.id) lines,
        count(distinct g.id) filter (where k.ack_status = 'ERROR') err,
        count(distinct g.id) filter (where k.ack_status = 'SUCCESS') ok
      from gr_match g
      join ba_sk bs on bs.ba = g.ba
      left join gr_ack k on k.interface_id_ref = g.id
      group by bs.sk),
    gr_an as materialized (select distinct ba, an from gr_match where an is not null),
    fa_i as materialized (
      select i.id, i.po_number po, i.receipt_number rn,
        regexp_replace(regexp_replace(i.receipt_number, '_[0-9]+$', ''), '_v[0-9]+[.][0-9]+$', '') rs
      from oracle_fusion_intppm_002_interface i
      where coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and i.po_number in (select po from ba_po)),
    fa_match as materialized (
      select distinct f.id, g.ba
      from fa_i f
      join ba_po bp on bp.po = f.po
      join gr_an g on g.ba = bp.ba and (f.rn = g.an or f.rs = g.an)),
    fa_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intppm_002_ack a where a.interface_id_ref in (select id from fa_match)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    fa_agg as materialized (
      select bs.sk, count(distinct f.id) lines,
        count(distinct f.id) filter (where k.ack_status = 'ERROR') err,
        count(distinct f.id) filter (where k.ack_status = 'SUCCESS') ok
      from fa_match f
      join ba_sk bs on bs.ba = f.ba
      left join fa_ack k on k.interface_id_ref = f.id
      group by bs.sk)
    select 'cac' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select v, ${WF_LABEL} s, d, a from latest_cac) x group by 2,3,4
    union all select 'cacGr' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, b.a, ${FUNNEL_STATUS} s
      from b left join gr_agg g on g.sk = b.sk) y group by 2,3,4
    union all select 'cacFa' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, b.a, ${FUNNEL_STATUS} s
      from b left join fa_agg g on g.sk = b.sk) z group by 2,3,4`,

  // Page 2 fusionFa + fusionGr: 1 query (CTE universe PATP∪CAC sekali).
  // Data identik query terpisah sebelumnya — hemat ~1× PATP_BASE + CAC di full run.
  fusionAll: `${PATP_BASE_CTE(USE_PG)},
    patp_b as materialized (select sk, v, d from latest_patp where st like 'Acceptance Fully Approved%'),
    scoped_ba as materialized (
      select ba from (
        select x.ba_number ba,
          bool_or(${IN_PO('x.po_number')}) has_in,
          bool_or(x.po_number is not null and x.po_number not in (select po from scope_po)) has_out
        from acceptance_certificate_detail x group by 1) t
      where has_in and not has_out),
    ba_sk_all as materialized (
      select distinct d.system_key sk, h.ba_number ba, nullif(h.vendor_code,'') v,
        coalesce(h.updated_at, h.created_at) ts
      from acceptance_certificate_detail d
      join scoped_ba s on s.ba = d.ba_number
      join acceptance_certificate_header h on h.ba_number = d.ba_number
      where d.system_key is not null and d.system_key <> ''),
    wf as materialized (
      select distinct on (w.entity_id) w.entity_id ba, w.status wf
      from workflow_instances w
      where w.entity_type = 'acceptance_certificates' and w.entity_id in (select ba from ba_sk_all)
      order by w.entity_id, w.version desc, w.id desc),
    cac_b as materialized (
      select b.sk, max(b.v) v, ${DT('max(b.ts)')} d
      from ba_sk_all b left join wf w on w.ba = b.ba
      group by b.sk
      having bool_or(w.wf = 'completed')),
    u as materialized (
      select sk, max(v) v, max(d) d from (
        select sk, v, d from patp_b
        union all
        select sk, v, d from cac_b) x
      group by sk),
    mps_val as materialized (
      select sk.system_key sk,
        coalesce(sum(case when ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0) a_svc,
        coalesce(sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0) a_all
      from sk
      join u on u.sk = sk.system_key
      join mapping_systemkey_po p on p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
      left join lateral (select t.net_price::numeric np from transaction_po t
        where t.po_number = p.po and t.line_subline = p.material_line_item
          and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
        order by t.created_at desc, t.id desc limit 1) tp on true
      group by sk.system_key
      union all
      select p.system_key sk,
        coalesce(sum(case when ${IS_SVC('p')} and p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0),
        coalesce(sum(case when p.quanty_mapping ~ ${NUM_RE} then p.quanty_mapping::numeric * tp.np end), 0)
      from mapping_systemkey_po p
      join u on u.sk = p.system_key
      left join lateral (select t.net_price::numeric np from transaction_po t
        where t.po_number = p.po and t.line_subline = p.material_line_item
          and upper(trim(coalesce(t.currency,''))) = 'IDR' and t.net_price ~ ${NUM_RE}
        order by t.created_at desc, t.id desc limit 1) tp on true
      where p.status_id in (1,2) and ${IN_PO('p.po')}
        and not exists (select 1 from sk where sk.system_key = p.system_key)
      group by p.system_key),
    patp_an as materialized (
      select distinct la.system_key sk, la.acceptance_number an
      from list_acceptance la
      where la.acceptance_number like 'PATP-%'
        and la.status like 'Acceptance Fully Approved%'
        and la.system_key in (select sk from patp_b)),
    ba_done as materialized (
      select distinct bsa.ba
      from ba_sk_all bsa
      join wf on wf.ba = bsa.ba and wf.wf = 'completed'
      where bsa.sk in (select sk from cac_b)),
    ba_sk as materialized (
      select distinct d.ba_number ba, d.system_key sk from acceptance_certificate_detail d
      where d.ba_number in (select ba from ba_done) and d.system_key is not null and d.system_key <> ''),
    ba_po as materialized (
      select distinct d.ba_number ba, d.po_number po from acceptance_certificate_detail d
      where d.ba_number in (select ba from ba_done) and d.po_number is not null),
    ba_patp as materialized (
      select distinct bs.ba, la.acceptance_number an from ba_sk bs
      join list_acceptance la on la.system_key = bs.sk and la.acceptance_category = 'PATP'),
    gr_i as materialized (
      select i.id, nullif(trim(i.system_key),'') sk, i.po_numbers po, i.acceptance_number an, i.ba_reference br
      from oracle_fusion_intinv_005_interface i
      where coalesce(i.file_type,'') ilike 'service%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    -- PATP: gr_i dipakai ulang; OR / regexp diganti UNION equality join (hasil sama).
    gr_patp as materialized (
      select i.id, ba.sk from patp_an ba join gr_i i on i.an = ba.an
      union
      select i.id, ba.sk from patp_an ba join gr_i i on i.br = ba.an),
    fa_psrc as materialized (
      select i.id, i.receipt_number rn, regexp_replace(i.receipt_number, '_[0-9]+$', '') rs
      from oracle_fusion_intppm_002_interface i
      where i.receipt_number like 'PATP-%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    fa_patp as materialized (
      select f.id, ba.sk from patp_an ba join fa_psrc f on f.rn = ba.an
      union
      select f.id, ba.sk from patp_an ba join fa_psrc f on f.rs = ba.an),
    gr_match as materialized (
      select distinct i.id, bp.ba, i.an
      from gr_i i join ba_sk bs on bs.sk = i.sk join ba_po bp on bp.ba = bs.ba and bp.po = i.po
      union
      select distinct i.id, p.ba, i.an from gr_i i join ba_patp p on i.an = p.an
      union
      select distinct i.id, p.ba, i.an from gr_i i join ba_patp p on i.br = p.an
      union
      select distinct i.id, bd.ba, i.an from gr_i i join ba_done bd on i.an = bd.ba where i.sk is null
      union
      select distinct i.id, bd.ba, i.an from gr_i i join ba_done bd on i.br = bd.ba where i.sk is null),
    gr_cac as materialized (
      select distinct g.id, bs.sk
      from gr_match g
      join ba_sk bs on bs.ba = g.ba),
    fa_i as materialized (
      select i.id, i.po_number po, i.receipt_number rn,
        regexp_replace(regexp_replace(i.receipt_number, '_[0-9]+$', ''), '_v[0-9]+[.][0-9]+$', '') rs
      from oracle_fusion_intppm_002_interface i
      where coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and i.po_number in (select po from ba_po)),
    fa_cac as materialized (
      select distinct f.id, bs.sk
      from fa_i f
      join ba_po bp on bp.po = f.po
      join gr_match g on g.ba = bp.ba and (f.rn = g.an or f.rs = g.an)
      join ba_sk bs on bs.ba = g.ba),
    gr_all as materialized (
      select id, sk from gr_patp
      union
      select id, sk from gr_cac),
    fa_all as materialized (
      select id, sk from fa_patp
      union
      select id, sk from fa_cac),
    gr_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_005_ack a where a.interface_id_ref in (select id from gr_all)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    fa_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intppm_002_ack a where a.interface_id_ref in (select id from fa_all)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    g_gr as materialized (
      select f.sk, count(distinct f.id) lines,
        count(distinct f.id) filter (where k.ack_status = 'ERROR') err,
        count(distinct f.id) filter (where k.ack_status = 'SUCCESS') ok
      from gr_all f
      left join gr_ack k on k.interface_id_ref = f.id
      group by f.sk),
    g_fa as materialized (
      select f.sk, count(distinct f.id) lines,
        count(distinct f.id) filter (where k.ack_status = 'ERROR') err,
        count(distinct f.id) filter (where k.ack_status = 'SUCCESS') ok
      from fa_all f
      left join fa_ack k on k.interface_id_ref = f.id
      group by f.sk),
    -- Not Sent GR Service: satu alasan per system key (prioritas scheduler).
    ns as materialized (
      select u.sk, u.v, u.d, coalesce(mv.a_svc, 0) a
      from u
      left join mps_val mv on mv.sk = u.sk
      where not exists (select 1 from g_gr g where g.sk = u.sk)),
    ns_line as materialized (
      select ns.sk,
        bool_or(${IS_SVC('p')}) has_svc,
        bool_or(not ${IS_SVC('p')}) has_mat,
        bool_or(p.po is not null and p.po not in (select po from scope_po)) has_out_po
      from ns
      join sk on sk.system_key = ns.sk
      join mapping_systemkey_po p on p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
      group by ns.sk
      union all
      select ns.sk,
        bool_or(${IS_SVC('p')}),
        bool_or(not ${IS_SVC('p')}),
        bool_or(p.po is not null and p.po not in (select po from scope_po))
      from ns
      join mapping_systemkey_po p on p.system_key = ns.sk
      where not exists (select 1 from sk where sk.system_key = ns.sk)
        and p.status_id in (1,2) and ${IN_PO('p.po')}
      group by ns.sk),
    ns_mps_fa as materialized (
      select distinct on (sk.system_key) sk.system_key sk,
        coalesce(ms.name = 'MPS Fully Approved', false) mps_fa
      from sk
      join ns on ns.sk = sk.system_key
      join mps_transaction t on t.mps_transaction_id = sk.transaction_id
      left join mps_status ms on ms.id = t.status_approval
      order by sk.system_key, t.id desc),
    ns_gi_ok as materialized (
      select distinct i.system_key sk
      from oracle_fusion_intinv_006_interface i
      join ns on ns.sk = i.system_key
      where coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and exists (
          select 1 from oracle_fusion_intinv_006_ack a
          where a.interface_id_ref = i.id and a.ack_status = 'SUCCESS')),
    ns_reason as materialized (
      select ns.sk, ns.v, ns.d, ns.a,
        case
          when not coalesce(l.has_svc, false) then 'No service line'
          when coalesce(l.has_out_po, false) then 'Non-Fusion PO'
          when exists (select 1 from sk where sk.system_key = ns.sk)
            and not coalesce(mf.mps_fa, false) then 'MPS not Fully Approved'
          when not coalesce(l.has_mat, false)
            and not exists (select 1 from cac_b c where c.sk = ns.sk)
            then 'Awaiting CAC (service-only)'
          when coalesce(l.has_mat, false)
            and not exists (select 1 from patp_b p where p.sk = ns.sk)
            and not exists (select 1 from ns_gi_ok g where g.sk = ns.sk)
            then 'Missing send gate'
          else 'Other / not yet exported'
        end s
      from ns
      left join ns_line l on l.sk = ns.sk
      left join ns_mps_fa mf on mf.sk = ns.sk)
    select 'fusionGr' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select u.v, u.d, coalesce(mv.a_svc, 0) a, ${FUNNEL_STATUS} s
      from u
      left join mps_val mv on mv.sk = u.sk
      left join g_gr g on g.sk = u.sk) x group by 2,3,4
    union all select 'fusionFa' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select u.v, u.d, coalesce(mv.a_all, 0) a, ${FUNNEL_STATUS} s
      from u
      left join mps_val mv on mv.sk = u.sk
      left join g_fa g on g.sk = u.sk) y group by 2,3,4
    union all select 'fusionGrNotSent' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select v, s, d, a from ns_reason) z group by 2,3,4`,

  // 1 system key = 1 hitungan; status approval SK pada endorsement TERBARU.
  endorsement: `with e as materialized (
      select distinct on (system_key)
        system_key sk, endorse_number, nullif(vendor_code,'') v,
        ${DT('coalesce(updated_at, created_at)')} d,
        created_at c
      from endorsements
      where system_key is not null and system_key <> ''
        and (${IN_PO('po_number')} or ${IN_SK('system_key')})
      order by system_key, coalesce(updated_at, created_at) desc nulls last, endorse_number desc),
    l as materialized (
      select distinct on (e.sk) e.sk, e.v, e.d, h.approval_value
      from e
      left join endorsement_history_approval h
        on h.system_key = e.sk and h.created_at >= e.c - interval '1 minute'
      order by e.sk, h.created_at desc nulls last, h.id desc)
    select v,
      case when approval_value = 'ENDORSE_APPROVED' then 'Fully Approved'
           when approval_value = 'REJECTED' then 'Rejected'
           else 'Waiting Approval' end s,
      d, count(*) n
    from l group by 1,2,3`,

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

  // Page 2 MPS Approved (+ ACK outcomes): netgear_mps_approved_rows + upload file_name.
  // Backfill (file_name ilike 'backfill%') BUKAN Sent — status "Backfill (no ACK expected)".
  // ACK rollup hanya dari line non-backfill. Ada normal+backfill → pakai normal.
  // netgearMpsApprovedAck = subset Success/Waiting/Error (derived di Node).
  ...(() => {
    const base = `tx as materialized (select p.transaction_id, max(p.update_time) ut from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
      okx as materialized (select tx.transaction_id, tx.ut from tx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = tx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
      m as (select t.mps_transaction_id, max(nullif(t.vendor_code,'')) vc,
          ${DT('greatest(max(t.created_date), max(okx.ut))')} d
        from mps_transaction t join okx on okx.transaction_id = t.mps_transaction_id group by 1),
      b as (select distinct on (t.mps_transaction_id) t.mps_transaction_id, t.status_approval
        from mps_transaction t join m using (mps_transaction_id) order by t.mps_transaction_id, t.id desc),
      sk as materialized (select distinct on (p.system_key) p.system_key, p.transaction_id
        from mapping_systemkey_po p join okx on okx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> ''
        order by p.system_key, p.update_time desc nulls last, p.transaction_id desc),
      fa as materialized (
        select sk.system_key sk, m.vc v, m.d d
        from sk join b on b.mps_transaction_id = sk.transaction_id
        join m on m.mps_transaction_id = sk.transaction_id
        left join mps_status ms on ms.id = b.status_approval
        where coalesce(ms.name, 'Status ' || b.status_approval) = 'MPS Fully Approved'
          and exists (select 1 from mapping_systemkey_po p
            where p.system_key = sk.system_key and p.transaction_id = sk.transaction_id
              and p.quanty_mapping ~ ${NUM_RE})),
      latest as materialized (
        select distinct on (r.system_key, coalesce(r.transaction_id,''), coalesce(r.po,''), coalesce(r.material_line_item,''))
          r.system_key sk, r.ack_status,
          (coalesce(u.file_name,'') ilike 'backfill%') as is_backfill
        from netgear_mps_approved_rows r
        left join netgear_upload_logs u on u.id = r.upload_log_id
        where r.superseded_at is null and r.system_key in (select sk from fa)
        order by r.system_key, coalesce(r.transaction_id,''), coalesce(r.po,''), coalesce(r.material_line_item,''),
          r.exported_at desc nulls last, r.id desc),
      agg_normal as materialized (
        select sk, count(*) lines,
          count(*) filter (where lower(coalesce(ack_status,'')) in ('true','t','1','success')) ok,
          count(*) filter (where lower(coalesce(ack_status,'')) in ('false','f','0','error')) err
        from latest where not is_backfill group by sk),
      agg_bf as materialized (
        select sk, count(*) lines from latest where is_backfill group by sk),
      st as materialized (
        select f.v, f.d, f.sk,
          case
            when n.sk is not null then
              case when n.err > 0 then 'ACK Error' when n.ok = n.lines then 'ACK Success' else 'Waiting ACK' end
            when b.sk is not null then 'Backfill (no ACK expected)'
            else 'Not Sent'
          end s
        from fa f
        left join agg_normal n on n.sk = f.sk
        left join agg_bf b on b.sk = f.sk)`
    return {
      netgearMpsApproved: `with ${base}
    select v, s, d, count(*) n from st group by 1,2,3`,
    }
  })(),

  netgearTaggingMos: NETGEAR_TAGGING_WITH_MPS_ACK('MOS'),
  netgearTaggingGreen: NETGEAR_TAGGING_WITH_MPS_ACK('GREEN'),

  // Dibangun dinamis di main(): hanya vendor yang dipakai (DBX memotong sel >200 karakter, jadi jangan string_agg).
}

// ---------- Guard read-only ----------
const WRITE_RE = /\b(insert|update|delete|drop|truncate|alter|create|grant|revoke|copy|call|do)\b/i
function assertReadOnly(sql) {
  if (!/^\s*(select|with)\b/i.test(sql)) throw new Error('Hanya SELECT/WITH yang diizinkan')
  if (WRITE_RE.test(sql)) throw new Error('Keyword non-read terdeteksi')
}

// ---------- Runner: pg (pool + paralel untuk query independen) ----------
async function makePgRunner() {
  const { default: pg } = await import('pg')
  // Pool kecil. connectionTimeout >= heavy statement timeout (antrian slot = connect time).
  const poolSize = Math.min(6, Math.max(2, Number(process.env.SANITATION_PG_POOL) || 6))
  const pool = new pg.Pool({
    connectionString: process.env.PMIS_DATABASE_URL,
    max: poolSize,
    connectionTimeoutMillis: HEAVY_TIMEOUT_MS,
    idleTimeoutMillis: 60_000,
    allowExitOnIdle: true,
  })
  pool.on('error', (err) => {
    if (VERBOSE) console.error('[sanitation] pool error:', err.message)
  })
  return {
    parallel: true,
    /** Satu connect dulu — DB mati gagal 1× timeout, bukan N query × timeout. */
    async ping() {
      const client = await pool.connect()
      client.release()
    },
    /** @param {string} sql @param {{ timeoutMs?: number }} [opts] */
    async rows(sql, opts = {}) {
      const timeoutMs = Math.max(1, Number(opts.timeoutMs) || QUERY_TIMEOUT_MS)
      const client = await pool.connect()
      const onErr = (err) => {
        if (VERBOSE) console.error('[sanitation] client error:', err.message)
      }
      client.on('error', onErr)
      try {
        await client.query(`set statement_timeout = ${timeoutMs}`)
        await client.query('set lock_timeout = 2000')
        await client.query('begin read only')
        await client.query("set local work_mem = '256MB'")
        await client.query('set local jit = off')
        const res = await client.query(sql)
        await client.query('rollback').catch(() => {})
        return res.rows
      } finally {
        client.removeListener('error', onErr)
        client.release()
      }
    },
    async close() {
      await pool.end()
    },
  }
}

/** Jalankan job dengan batas concurrency (hindari N query berat paralel ke DB yang sama). */
async function runWithConcurrency(fns, limit) {
  const n = Math.max(1, Math.min(limit, fns.length || 1))
  let i = 0
  await Promise.all(Array.from({ length: n }, async () => {
    while (i < fns.length) {
      const idx = i++
      await fns[idx]()
    }
  }))
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
    parallel: false,
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
  // Anomaly rows first — labels may contain "ACK Success" as negated text.
  if (/^anomaly:/.test(l) && /ack error|without mps export/.test(l)) return 'bad'
  if (/^anomaly:/.test(l)) return 'wait'
  if (/reject|cancel|dropped|ack error/.test(l)) return 'bad'
  if (/fully approved|fully implemented|^approved|ack success|has bf on master tracker/.test(l)) return 'ok'
  if (/^backfill\b/.test(l)) return 'neutral'
  if (/waiting|progress|draft|reserved|ready|await|pending|no workflow|not sent|not approved|\bneed\b/.test(l)) return 'wait'
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

/** Baca snapshot latest dari Supabase (untuk inherit modul bila query gagal/di-skip). */
async function readLatestSnapshot() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return null
  const res = await fetch(`${url}/rest/v1/sanitation_report_snapshots?id=eq.latest&select=payload`, {
    headers: { apikey: key, Authorization: `Bearer ${key}` },
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) return null
  const rows = await res.json()
  return rows?.[0]?.payload || null
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
  const failed = []
  try {
    if (typeof runner.ping === 'function') await runner.ping()
    if (SKIP_PATP_ON_DBX) console.error('[sanitation] DBX: skip patpAll/patpFunnel (timeout 60s) — inherit snapshot lama; paksa: SANITATION_FORCE_PATP=1')
    // Alias: fusionFa/Gr → fusionAll; ACK Netgear → query Sent (ACK di-derive di Node).
    const onlySet = ONLY
      ? new Set(ONLY.flatMap((n) => {
          if (n === 'fusionFa' || n === 'fusionGr') return ['fusionAll']
          if (n === 'netgearMpsApprovedAck') return ['netgearMpsApproved']
          return [n]
        }))
      : null
    // Query berat: timeout longgar. Wave 1 = ringan (cepat paralel), wave 2 = berat (aman).
    const HEAVY = new Set([
      'patpAll', 'patpFunnel', 'cacAll', 'fusionAll', 'baseline', 'endorsement', 'siteTransfer',
      'patpScopeVal', 'netgearTaggingMos', 'netgearTaggingGreen', 'netgearMpsApproved',
    ])
    // Perkiraan durasi menurun (dari log nyata) untuk urutan start job berat.
    const HEAVY_ORDER = ['fusionAll', 'patpFunnel', 'patpAll', 'baseline', 'cacAll', 'siteTransfer', 'netgearTaggingGreen', 'netgearTaggingMos', 'netgearMpsApproved', 'endorsement']
    // PG full run: patpScope sudah di patpAll — skip patpScopeVal agar tidak dobel PATP_BASE.
    const skipScopeVal = USE_PG && !onlySet
    const lightLimit = Math.max(1, Number(process.env.SANITATION_PG_CONCURRENCY) || 4)
    const heavyLimit = Math.max(1, Number(process.env.SANITATION_PG_HEAVY_CONCURRENCY) || 2)
    if (VERBOSE && runner.parallel) {
      console.error(`[sanitation] pg light=${lightLimit} heavy=${heavyLimit}, heavy timeout=${HEAVY_TIMEOUT_MS}ms`)
    }
    const lightJobs = []
    const heavyJobs = []
    for (const [name, rawSql] of Object.entries(Q)) {
      if (onlySet && !onlySet.has(name)) {
        raw[name] = []
        timings[name] = 0
        continue
      }
      if (skipScopeVal && name === 'patpScopeVal') {
        raw[name] = []
        timings[name] = 0
        if (VERBOSE) console.error('[sanitation] patpScopeVal: skip (sudah di patpAll)')
        continue
      }
      if (SKIP_PATP_ON_DBX && (name === 'patpAll' || name === 'patpFunnel')) {
        raw[name] = []
        timings[name] = 0
        failed.push(name)
        if (VERBOSE) console.error(`[sanitation] ${name}: skip (DBX)`)
        continue
      }
      const sql = withScope(rawSql)
      assertReadOnly(sql)
      const timeoutMs = HEAVY.has(name) ? HEAVY_TIMEOUT_MS : QUERY_TIMEOUT_MS
      const job = async () => {
        const t = Date.now()
        try {
          raw[name] = await runner.rows(sql, { timeoutMs })
          timings[name] = Date.now() - t
          if (VERBOSE) console.error(`[sanitation] ${name}: ${process.env.SANITATION_COUNT ? JSON.stringify(raw[name]) : raw[name].length + ' baris'}, ${timings[name]} ms`)
        } catch (e) {
          timings[name] = Date.now() - t
          failed.push(name)
          raw[name] = []
          console.error(`[sanitation] ${name}: GAGAL (${timings[name]} ms) — ${e.message}`)
        }
      }
      ;(HEAVY.has(name) ? heavyJobs : lightJobs).push({ name, job })
    }
    // Terlama dulu (LPT) → makespan terpendek dengan slot heavy terbatas.
    const heavyRank = (n) => { const i = HEAVY_ORDER.indexOf(n); return i < 0 ? HEAVY_ORDER.length : i }
    heavyJobs.sort((a, b) => heavyRank(a.name) - heavyRank(b.name))
    if (runner.parallel) {
      // Ringan dan berat jalan bersamaan (tidak menunggu wave ringan selesai dulu).
      await Promise.all([
        lightJobs.length ? runWithConcurrency(lightJobs.map((j) => j.job), lightLimit) : null,
        heavyJobs.length ? runWithConcurrency(heavyJobs.map((j) => j.job), heavyLimit) : null,
      ])
    } else {
      for (const { job } of lightJobs) await job()
      for (const { job } of heavyJobs) await job()
    }
    if (DRY && process.env.SANITATION_DUMP_RAW) {
      writeFileSync(process.env.SANITATION_DUMP_RAW, JSON.stringify(raw))
    }
    // ACK = subset Sent (tanpa query kedua; data identik filter status).
    if ((!onlySet || onlySet.has('netgearMpsApproved') || onlySet.has('netgearMpsApprovedAck'))
      && Array.isArray(raw.netgearMpsApproved) && raw.netgearMpsApproved.length) {
      const tAck = Date.now()
      raw.netgearMpsApprovedAck = raw.netgearMpsApproved.filter((r) =>
        r.s === 'ACK Success' || r.s === 'Waiting ACK' || r.s === 'ACK Error')
      timings.netgearMpsApprovedAck = Date.now() - tAck
      if (VERBOSE) console.error(`[sanitation] netgearMpsApprovedAck: ${raw.netgearMpsApprovedAck.length} baris (derived), ${timings.netgearMpsApprovedAck} ms`)
    } else if (!raw.netgearMpsApprovedAck) {
      raw.netgearMpsApprovedAck = []
    }
    const codes = [...new Set(Object.values(raw).flat().map((r) => r.v).filter(Boolean))]
    const t0 = Date.now()
    const vendorSql = codes.length
      ? `select code, trim(name) as vname from master_vendor where code in (${codes.map((c) => `'${String(c).replace(/'/g, "''")}'`).join(',')})`
      : null
    if (vendorSql) assertReadOnly(vendorSql)
    try {
      raw.vendors = vendorSql ? await runner.rows(vendorSql) : []
    } catch (e) {
      console.error(`[sanitation] vendors: GAGAL — ${e.message}`)
      raw.vendors = []
    }
    timings.vendors = Date.now() - t0
  } finally {
    await runner.close()
  }
  if (USE_PG && failed.length && !ONLY) throw new Error(`Query gagal; snapshot lama dipertahankan: ${failed.join(', ')}`)

  const part = (k) => [...(raw.patpAll || []), ...(raw.patpFunnel || [])].filter((r) => r.k === k)
  const cacPart = (k) => (raw.cacAll || []).filter((r) => r.k === k)
  const fusionPart = (k) => (raw.fusionAll || []).filter((r) => r.k === k)
  // a_svc dihitung sekali di query mps/mpsReserved (hindari query mpsService terpisah ~4 mnt di DBX).
  const mpsRaw = raw.mps || []
  const mpsResRaw = raw.mpsReserved || []
  const dropSvc = (rows) => rows.map(({ a_svc, ...r }) => r)
  const asService = (rows) => rows.map(({ a, a_svc, ...r }) => ({ ...r, a: a_svc }))
  const modules = {
    baseline: toRows(raw.baseline),
    mps: toRows(dropSvc(mpsRaw)),
    mpsReserved: toRows(dropSvc(mpsResRaw), { normalize: false }),
    mpsMaterial: toRows(raw.mpsMaterial),
    siteTransfer: toRows(raw.siteTransfer),
    mpsService: toRows([...asService(mpsRaw), ...asService(mpsResRaw)], { normalize: false }),
    matc: toRows(raw.matc),
    matcGr: toRows(raw.matcGr),
    fatp: toRows(part('fatp').map(({ a, ...r }) => r)),
    fatpScope: toRows(part('fatpScope').map(({ a, ...r }) => r), { normalize: false }),
    patp: toRows(part('patp')),
    // Of-Y Rp = valuasi MPS/PO (semua line IDR) untuk universe patp_need.
    // Di DBX patpAll sering di-skip → pakai query ringan patpScopeVal.
    patpScope: toRows(part('patpScope').length ? part('patpScope') : (raw.patpScopeVal || []), { normalize: false }),
    patpGi: toRows(part('patpGi')),
    patpGr: toRows(part('patpGr')),
    patpFa: toRows(part('patpFa')),
    cac: toRows(cacPart('cac')),
    cacGr: toRows(cacPart('cacGr')),
    cacFa: toRows(cacPart('cacFa')),
    // Page 2 Fixed Asset / GR Service = PATP ∪ CAC (dari fusionAll; fallback nama lama).
    fusionFa: toRows(fusionPart('fusionFa').length ? fusionPart('fusionFa') : (raw.fusionFa || [])),
    fusionGr: toRows(fusionPart('fusionGr').length ? fusionPart('fusionGr') : (raw.fusionGr || [])),
    fusionGrNotSent: toRows(fusionPart('fusionGrNotSent')),
    endorsement: toRows(raw.endorsement),
    caf: toRows(raw.caf),
    crRelocation: toRows(raw.cr),
    cafAction: toRows(raw.cafAction, { normalize: false }),
    // Page 2 — Netgear interface legs (Fusion legs reuse siteTransfer/matcGr/patpGi/patpGr/patpFa above).
    netgearMpsApproved: toRows(raw.netgearMpsApproved),
    netgearMpsApprovedAck: toRows(raw.netgearMpsApprovedAck),
    netgearTaggingMos: toRows(raw.netgearTaggingMos, { normalize: false }),
    netgearTaggingGreen: toRows(raw.netgearTaggingGreen),
  }

  // Inherit modul kosong dari snapshot sebelumnya (query timeout DBX / SANITATION_ONLY).
  if (failed.length || ONLY) {
    const prev = await readLatestSnapshot()
    if (prev?.modules) {
      let inherited = 0
      for (const [k, rows] of Object.entries(prev.modules)) {
        if ((!modules[k] || modules[k].length === 0) && Array.isArray(rows) && rows.length > 0) {
          modules[k] = rows
          inherited++
          console.error(`[sanitation] inherit ${k} dari snapshot sebelumnya (${rows.length} baris)`)
        }
      }
      if (inherited) console.error(`[sanitation] ${inherited} modul di-inherit; gagal/skip: ${(failed.length ? failed : ONLY).join(',')}`)
    } else if (failed.length) {
      console.error(`[sanitation] peringatan: ${failed.join(',')} gagal dan tidak ada snapshot lama untuk di-inherit`)
    }
  }

  const nameByCode = new Map(raw.vendors.filter((r) => r.vname).map((r) => [r.code, r.vname]))
  const usedCodes = new Set(Object.values(modules).flat().map((r) => r.v))
  let vendors = [...usedCodes]
    .map((code) => ({ code, name: code === UNKNOWN_VENDOR ? 'Unknown vendor' : nameByCode.get(code) || code }))
    .sort((a, b) => a.name.localeCompare(b.name))
  if (nameByCode.size === 0) {
    const prev = await readLatestSnapshot()
    if (prev?.vendors?.length) {
      const prevMap = new Map(prev.vendors.map((v) => [v.code, v.name]))
      vendors = [...usedCodes]
        .map((code) => ({ code, name: code === UNKNOWN_VENDOR ? 'Unknown vendor' : prevMap.get(code) || code }))
        .sort((a, b) => a.name.localeCompare(b.name))
      console.error('[sanitation] inherit vendors dari snapshot sebelumnya')
    } else {
      throw new Error('master_vendor kosong / gagal dibaca')
    }
  }

  const earliest = Object.values(modules).flat().map((r) => r.d).filter(Boolean).sort()[0] || null
  const payload = {
    version: 3,
    generatedAt: new Date().toISOString(),
    since: earliest,
    scope: 'sap-fusion,fusion',
    dailyDays: BUCKET_DAYS,
    durationMs: Date.now() - started,
    timings,
    failedQueries: failed.length ? failed : undefined,
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

  const amounts = Object.fromEntries(
    Object.entries(modules)
      .map(([k, rows]) => [k, rows.reduce((s, r) => s + (r.a || 0), 0)])
      .filter(([, a]) => a > 0),
  )
  if (DRY) {
    console.log(JSON.stringify({ totals, amounts, vendorCoverage: unknownShare, vendors: vendors.length, timings, durationMs: payload.durationMs, bytes: JSON.stringify(payload).length }, null, 2))
  } else {
    await writeSnapshot(payload)
    console.log(`[sanitation] snapshot v3 ditulis (${payload.durationMs} ms, ${JSON.stringify(payload).length} bytes)`)
  }
}

main().catch((e) => {
  console.error('[sanitation] GAGAL:', e.message)
  process.exit(1)
})
