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
// Selalu log progress per query (DBX sekuensial bisa >10 mnt; tanpa log terlihat hang).
const VERBOSE = true
// Boleh dipakai tanpa --dry-run (merge modul lain dari snapshot sebelumnya).
const ONLY = process.env.SANITATION_ONLY ? process.env.SANITATION_ONLY.split(',') : null
const REQUIRE_VPN = process.argv.includes('--require-vpn')
const DBX_PATH = process.env.DBX_MCP_PATH || 'C:\\Users\\ACER\\.dbx\\bin\\dbx-mcp.exe'
const DBX_CONNECTION = process.env.DBX_CONNECTION || 'PMIS Prod'
const PMIS_DB = process.env.PMIS_DB_NAME || 'pmisdb_20261008'
const QUERY_TIMEOUT_MS = Math.max(1, Number(process.env.SANITATION_QUERY_TIMEOUT_MS) || 300_000)
const UNKNOWN_VENDOR = 'UNKNOWN'
/** true = driver pg (paralel, timeout panjang). false = DBX sekuensial. */
const USE_PG = !!process.env.PMIS_DATABASE_URL
/**
 * Di DBX, patpAll/patpFunnel hampir selalu timeout 60s dan menduplikasi CTE need.
 * Default: skip + inherit dari snapshot lama. Paksa jalan: SANITATION_FORCE_PATP=1.
 */
const SKIP_PATP_ON_DBX = !USE_PG && process.env.SANITATION_FORCE_PATP !== '1'

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
      select distinct on (la.system_key)
        la.system_key sk, la.acceptance_number an, n.v, n.d, la.status st
      from list_acceptance la
      join patp_need n on n.sk = la.system_key
      where la.acceptance_number like 'PATP-%'
      order by la.system_key, coalesce(la.update_time, la.create_time) desc nulls last, la.acceptance_number desc),
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

// MATC per SYSTEM KEY (bukan per BA): 1 system key = 1 baris, memakai BA MATC TERBARU bila ada di beberapa BA
// (updated_date, fallback created_date, tie-break ba_number). Kolom tetap ba_number, sk, d, a agar query hilir tidak berubah.
// Hanya system key yang punya MPS dan >= 1 line material; Rp (a) = line material saja (harga PO terbaru, IDR).
const MATC_BA = (alias) => `select z.ba_number, z.sk, z.d, coalesce(v.a, 0) a from (
              select ba_number, sk, d from (
                select ${alias}.ba_number, dd.system_key sk, ${DT(`max(coalesce(${alias}.updated_date, ${alias}.created_date))`)} d,
                  row_number() over (partition by dd.system_key
                    order by max(coalesce(${alias}.updated_date, ${alias}.created_date)) desc nulls last, ${alias}.ba_number desc) rn
                from material_certificates ${alias}
                join material_certificate_details dd on dd.ba_number = ${alias}.ba_number
                where ${BA_SCOPE('material_certificate_details', `${alias}.ba_number`)}
                  and dd.system_key is not null and dd.system_key <> ''
                group by ${alias}.ba_number, dd.system_key) r where rn = 1) z
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
  const funnelTail = `
    b as materialized (select sk, an, v, d, st from latest_patp where st like 'Acceptance Fully Approved%'),
    b_an as materialized (select distinct an from b),
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
    gr_i as materialized (
      select distinct i.id, ba.an from b_an ba
      join oracle_fusion_intinv_005_interface i
        on (i.acceptance_number = ba.an or i.ba_reference = ba.an)
      where coalesce(i.file_type,'') ilike 'service%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    gr_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_005_ack a where a.interface_id_ref in (select id from gr_i)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    gr_agg as materialized (
      select i.an, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from gr_i i left join gr_ack k on k.interface_id_ref = i.id group by i.an),
    fa as materialized (
      select distinct i.id, kk.kx from oracle_fusion_intppm_002_interface i
      cross join lateral (select distinct x kx from (values (i.receipt_number), (regexp_replace(i.receipt_number, '_[0-9]+$', ''))) v(x)) kk
      where coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and i.receipt_number like 'PATP-%' and kk.kx in (select an from b_an)),
    fa_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intppm_002_ack a where a.interface_id_ref in (select id from fa)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    fl as materialized (
      select f.kx, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from fa f left join fa_ack k on k.interface_id_ref = f.id group by f.kx)`
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
      select b.v, b.d, coalesce(pv.a, 0) a, ${FUNNEL_STATUS} s
      from b left join pv on pv.sk = b.sk left join gi_agg g on g.sk = b.sk) x group by 2,3,4
    union all select 'patpGr' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, coalesce(pv.a, 0) a, ${FUNNEL_STATUS} s
      from b left join pv on pv.sk = b.sk left join gr_agg g on g.an = b.an) x group by 2,3,4
    union all select 'patpFa' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, coalesce(pv.a, 0) a, ${FUNNEL_STATUS} s
      from b left join pv on pv.sk = b.sk left join fl g on g.kx = b.an) x group by 2,3,4`
  // Query ringan of-Y saja (jalan di DBX meski patpAll di-skip).
  // Pakai withMtSc=true agar universe of-Y sama dengan jalur pg (~100rb; include Reserved via sitelist_mt).
  const patpScopeVal = `${PATP_BASE_CTE(true)},${scopeVal}
    select v, 'Required' s, d, count(*) n, coalesce(sum(a), 0)::bigint a from (
      select n.v, n.d, coalesce(sv.a, 0) a from patp_need n left join scope_val sv on sv.sk = n.sk) z group by v, d`
  if (USE_PG) {
    // Satu query: need CTE hanya sekali (hindari dobel beban DB saat paralel).
    return {
      patpAll: `${base},${scopeVal},${pvLatest},${funnelTail}
    ${funnelSelect}
    union all${coreSelect}`,
      // Fallback of-Y bila SANITATION_ONLY=patpScopeVal.
      patpScopeVal,
    }
  }
  // DBX: pecah (core vs funnel). Default tetap di-skip lewat SKIP_PATP_ON_DBX.
  return {
    patpAll: `${base},${scopeVal},${pvLatest}
    ${coreSelect}`,
    patpScopeVal,
    patpFunnel: `${base},
    b as materialized (select sk, an, v, d, st from latest_patp where st like 'Acceptance Fully Approved%'),
    b_an as materialized (select distinct an from b),
    l as materialized (
      select s.acceptance_number, s.po_number, s.line_item, s.mapping_po_sk_quantity
        from service_powo_acceptance s where s.acceptance_number in (select an from b_an)
      union all
      select m.acceptance_number, m.po_number, m.line_item, m.mapping_po_sk_quantity
        from material_acceptance m where m.acceptance_number in (select an from b_an)),
    mp as materialized (select distinct on (po, material_line_item, system_key) po, material_line_item, system_key, quanty_mapping
      from mapping_systemkey_po where po in (select po_number from l) order by po, material_line_item, system_key, id desc),
    pv as materialized (
      select b.sk, sum(
          case when l.mapping_po_sk_quantity ~ ${NUM_RE} then least(l.mapping_po_sk_quantity::numeric,
                case when mp.quanty_mapping::text ~ ${NUM_RE} then mp.quanty_mapping::numeric else l.mapping_po_sk_quantity::numeric end) end
          * case when tp.net_price ~ ${NUM_RE} then tp.net_price::numeric end) a
        from b
        join l on l.acceptance_number = b.an
        left join mp on mp.po = l.po_number and mp.material_line_item = l.line_item and mp.system_key = b.sk
        join lateral (select t.net_price, t.currency from transaction_po t
          where t.po_number = l.po_number and t.line_subline = l.line_item
          order by t.created_at desc, t.id desc limit 1) tp on true
        where upper(trim(coalesce(tp.currency,''))) = 'IDR'
        group by b.sk),
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
    gr_i as materialized (
      select distinct i.id, ba.an from b_an ba
      join oracle_fusion_intinv_005_interface i
        on (i.acceptance_number = ba.an or i.ba_reference = ba.an)
      where coalesce(i.file_type,'') ilike 'service%' and coalesce(i.export_status,'') <> 'GATE_FILTERED'),
    gr_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intinv_005_ack a where a.interface_id_ref in (select id from gr_i)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    gr_agg as materialized (
      select i.an, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from gr_i i left join gr_ack k on k.interface_id_ref = i.id group by i.an),
    fa as materialized (
      select distinct i.id, kk.kx from oracle_fusion_intppm_002_interface i
      cross join lateral (select distinct x kx from (values (i.receipt_number), (regexp_replace(i.receipt_number, '_[0-9]+$', ''))) v(x)) kk
      where coalesce(i.export_status,'') <> 'GATE_FILTERED'
        and i.receipt_number like 'PATP-%' and kk.kx in (select an from b_an)),
    fa_ack as materialized (
      select distinct on (a.interface_id_ref) a.interface_id_ref, a.ack_status
      from oracle_fusion_intppm_002_ack a where a.interface_id_ref in (select id from fa)
      order by a.interface_id_ref, a.processing_date desc nulls last, a.id desc),
    fl as materialized (
      select f.kx, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from fa f left join fa_ack k on k.interface_id_ref = f.id group by f.kx)
    ${funnelSelect}`,
  }
})()

const Q = {
  // Hanya system key yang SUDAH punya MPS (set sama dengan card MPS); yang belum punya MPS tidak dihitung.
  // 1 system key = 1 baris (unik global): dibaca dari daftar baseline.system_key (json array), memakai baseline TERBARU
  // (update_time, fallback create_time, tie-break baseline_id) bila system key ada di beberapa baseline. x = jumlah project pembawa.
  baseline: `with tx as materialized (select p.transaction_id from mapping_systemkey_po p
          where ${IN_PO('p.po')} and p.transaction_id is not null group by 1),
      okx as materialized (select tx.transaction_id from tx where not exists (select 1 from mapping_systemkey_po q
          where q.transaction_id = tx.transaction_id and q.po is not null and q.po not in (select po from scope_po))),
      mpssk as materialized (select distinct p.system_key from mapping_systemkey_po p join okx on okx.transaction_id = p.transaction_id
        where p.system_key is not null and p.system_key <> '')
    select v, s, d, count(*) n, count(distinct baseline_id) x from (
      select b.baseline_id, nullif(b.vendor_code,'') v, regexp_replace(b.baseline_status, '\\s*:.*$', '') s,
        ${DT('coalesce(b.update_time, b.create_time)')} d,
        row_number() over (partition by k.v order by coalesce(b.update_time, b.create_time) desc nulls last, b.baseline_id desc) rn
      from baseline b cross join lateral json_array_elements_text(b.system_key) k(v)
      where json_typeof(b.system_key) = 'array' and ${IN_PO('b.po_number')} and k.v <> ''
        and k.v in (select system_key from mpssk)) z
    where rn = 1 group by 1,2,3`,

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

  // PATP: di pg = 1 query monolit (need CTE sekali). Di DBX default di-skip (lihat SKIP_PATP_ON_DBX).
  ...PATP_QUERIES,

  // CAC: 1 system key = 1 (BA terbaru). Funnel GR/FA per Fully Approved SK
  // (ACK dihitung per BA via hash-join, lalu di-join ke SK — sama pola PATP).
  // Rp = realisation Appendix 2 SERVICE lines only (IS_SVC); material excluded.
  // SK tanpa line service tetap dihitung (n) dengan a = 0.
  cacAll: `with scoped_ba as materialized (
      select ba from (
        select x.ba_number ba,
          bool_or(${IN_PO('x.po_number')}) has_in,
          bool_or(x.po_number is not null and x.po_number not in (select po from scope_po)) has_out
        from acceptance_certificate_detail x group by 1) t
      where has_in and not has_out),
    latest as materialized (
      select distinct on (d.system_key)
        d.system_key sk, h.ba_number ba, nullif(h.vendor_code,'') v,
        ${DT('coalesce(h.updated_at, h.created_at)')} d
      from acceptance_certificate_detail d
      join scoped_ba s on s.ba = d.ba_number
      join acceptance_certificate_header h on h.ba_number = d.ba_number
      where d.system_key is not null and d.system_key <> ''
      order by d.system_key, coalesce(h.updated_at, h.created_at) desc nulls last, h.ba_number desc),
    det as materialized (
      select d.id, l.sk, d.mapping_id, d.po_number, d.line_item, d.network_header
      from latest l
      join acceptance_certificate_detail d on d.ba_number = l.ba and d.system_key = l.sk),
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
    wf as materialized (
      select distinct on (w.entity_id) w.entity_id ba, w.status wf
      from workflow_instances w
      where w.entity_type = 'acceptance_certificates' and w.entity_id in (select ba from latest)
      order by w.entity_id, w.version desc, w.id desc),
    latest_cac as materialized (
      select l.sk, l.ba, l.v, l.d, coalesce(sv.a, 0) a, wf.wf
      from latest l
      left join sk_val sv on sv.sk = l.sk
      left join wf on wf.ba = l.ba),
    b as materialized (select sk, ba, v, d, a from latest_cac where wf = 'completed'),
    ba_done as materialized (select distinct ba from b),
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
      select g.ba, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from gr_match g left join gr_ack k on k.interface_id_ref = g.id group by g.ba),
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
      select f.ba, count(*) lines,
        count(*) filter (where k.ack_status = 'ERROR') err,
        count(*) filter (where k.ack_status = 'SUCCESS') ok
      from fa_match f left join fa_ack k on k.interface_id_ref = f.id group by f.ba)
    select 'cac' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select v, ${WF_LABEL} s, d, a from latest_cac) x group by 2,3,4
    union all select 'cacGr' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, b.a, ${FUNNEL_STATUS} s
      from b left join gr_agg g on g.ba = b.ba) y group by 2,3,4
    union all select 'cacFa' k, v, s, d, count(*) n, sum(a)::bigint a from (
      select b.v, b.d, b.a, ${FUNNEL_STATUS} s
      from b left join fa_agg g on g.ba = b.ba) z group by 2,3,4`,

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
  // Pool kecil + query paralel: menunggu slot bisa selama query terberat (patpAll ~5 mnt).
  // connectionTimeout harus >= statement timeout, bukan 15 dtk — kalau tidak, antrian slot dianggap "connect timeout".
  const poolSize = Math.min(6, Math.max(2, Number(process.env.SANITATION_PG_POOL) || 4))
  const pool = new pg.Pool({
    connectionString: process.env.PMIS_DATABASE_URL,
    max: poolSize,
    connectionTimeoutMillis: QUERY_TIMEOUT_MS,
    idleTimeoutMillis: 60_000,
    allowExitOnIdle: true,
  })
  pool.on('error', (err) => {
    if (VERBOSE) console.error('[sanitation] pool error:', err.message)
  })
  return {
    parallel: true,
    async rows(sql) {
      const client = await pool.connect()
      const onErr = (err) => {
        if (VERBOSE) console.error('[sanitation] client error:', err.message)
      }
      client.on('error', onErr)
      try {
        await client.query(`set statement_timeout = ${QUERY_TIMEOUT_MS}`)
        await client.query('set lock_timeout = 2000')
        await client.query('begin read only')
        // Bantu sort/hash CTE besar (patp/mps); set local harus di dalam transaksi.
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
    if (SKIP_PATP_ON_DBX) console.error('[sanitation] DBX: skip patpAll/patpFunnel (timeout 60s) — inherit snapshot lama; paksa: SANITATION_FORCE_PATP=1')
    const jobs = Object.entries(Q).map(([name, rawSql]) => {
      if (ONLY && !ONLY.includes(name)) return async () => { raw[name] = []; timings[name] = 0 }
      if (SKIP_PATP_ON_DBX && (name === 'patpAll' || name === 'patpFunnel')) {
        return async () => {
          raw[name] = []
          timings[name] = 0
          failed.push(name)
          if (VERBOSE) console.error(`[sanitation] ${name}: skip (DBX)`)
        }
      }
      const sql = withScope(rawSql)
      assertReadOnly(sql)
      return async () => {
        const t = Date.now()
        try {
          raw[name] = await runner.rows(sql)
          timings[name] = Date.now() - t
          if (VERBOSE) console.error(`[sanitation] ${name}: ${process.env.SANITATION_COUNT ? JSON.stringify(raw[name]) : raw[name].length + ' baris'}, ${timings[name]} ms`)
        } catch (e) {
          timings[name] = Date.now() - t
          failed.push(name)
          raw[name] = []
          console.error(`[sanitation] ${name}: GAGAL (${timings[name]} ms) — ${e.message}`)
        }
      }
    })
    if (runner.parallel) await Promise.all(jobs.map((fn) => fn()))
    else for (const fn of jobs) await fn()
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

  const part = (k) => [...(raw.patpAll || []), ...(raw.patpFunnel || [])].filter((r) => r.k === k)
  const cacPart = (k) => (raw.cacAll || []).filter((r) => r.k === k)
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
    endorsement: toRows(raw.endorsement),
    caf: toRows(raw.caf),
    crRelocation: toRows(raw.cr),
    cafAction: toRows(raw.cafAction, { normalize: false }),
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
