// Supabase Edge Function: Ingest Excel to site_data_5g
// POST multipart/form-data with file field "file" (Excel .xlsx/.xls/.xlsm)
// Row 1 empty, Row 2 header, Row 3+ data (same convention as TLP)

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
// Same import as process-aop-excel (Supabase Edge Function)
import * as XLSX from "https://esm.sh/xlsx@0.18.5";
import { createClient } from "jsr:@supabase/supabase-js@2";

const BATCH_SIZE = 200;
const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB - Edge Function limit ~256MB RAM, 2s CPU
const MAX_ROWS = 300; // Avoid WORKER_LIMIT; for larger files use Next.js API
const ALLOWED_TYPES = [
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/vnd.ms-excel.sheet.macroEnabled.12",
];

// site_data_5g columns (from Supabase schema)
const DATE_COLUMNS = new Set([
  "imp_integ_ff", "imp_integ_af", "rfs_ff", "rfs_af", "rfc_approved",
  "hotnews_af", "endorse_af", "pac_accepted_af", "5g_readiness_date", "5g_activation_date",
  "cx_submitted", "cx_approved", "created_at", "updated_at", "RF_Fusion.cutover_af",
  "rfs_bf", "mocn_activation_forecast", "rfs_forecast_lock", "caf_approved", "mos_af",
  "cluster_acceptance_af", "ic_000040_af", "patp_accepted_af",
]);

const NUMERIC_COLUMNS = new Set(["long", "lat"]);

function parseDate(value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") {
    // Excel serial
    if (value >= 1 && value <= 2958465) {
      const d = new Date((value - 25569) * 86400 * 1000);
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
    return null;
  }
  if (typeof value === "string") {
    const s = value.trim();
    if (!s) return null;
    const d = new Date(s);
    if (!isNaN(d.getTime())) {
      const y = d.getUTCFullYear(), m = d.getUTCMonth() + 1, day = d.getUTCDate();
      return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return null;
}

function normalizeHeader(h: string): string {
  return String(h || "").trim().replace(/\s+/g, "_").replace(/[^a-zA-Z0-9_.-]/g, "");
}

// Map Excel header to DB column (exact match or common variants)
const HEADER_TO_DB: Record<string, string> = {
  "system_key": "system_key", "SBOQ.project_type": "SBOQ.project_type",
  "vendor_code": "vendor_code", "vendor_name": "vendor_name", "wbs_status": "wbs_status",
  "site_id": "site_id", "site_name": "site_name", "new_site_id": "new_site_id", "new_site_name": "new_site_name",
  "unique_id": "unique_id", "relo_id": "relo_id", "relo_name": "relo_name", "site_category": "site_category",
  "po_number": "po_number", "po_subline": "po_subline", "network_header": "network_header", "year": "year",
  "program_name": "program_name", "project_name": "project_name", "program": "program", "program_report": "program_report",
  "ran_score": "ran_score", "region": "region", "region_wise": "region_wise", "region_circle": "region_circle",
  "nano_cluster": "nano_cluster", "twr_owner": "twr_owner", "long": "long", "lat": "lat",
  "scope_of_work": "scope_of_work", "issue_category": "issue_category", "site_status": "site_status",
  "highlevel_issue": "highlevel_issue", "ran_scope": "ran_scope", "scope_category": "scope_category",
  "imp_ttp": "imp_ttp", "mc_cluster": "mc_cluster",
  "imp_integ_ff": "imp_integ_ff", "imp_integ_af": "imp_integ_af", "rfs_ff": "rfs_ff", "rfs_af": "rfs_af",
  "rfc_approved": "rfc_approved", "hotnews_af": "hotnews_af", "endorse_af": "endorse_af", "pac_accepted_af": "pac_accepted_af",
  "5g_readiness_date": "5g_readiness_date", "5g_activation_date": "5g_activation_date",
  "cx_submitted": "cx_submitted", "cx_approved": "cx_approved", "cx_acceptance_status": "cx_acceptance_status", "cx_remark": "cx_remark",
  "RF_Fusion.cutover_af": "RF_Fusion.cutover_af", "rfs_bf": "rfs_bf",
  "mocn_activation_forecast": "mocn_activation_forecast", "rfs_forecast_lock": "rfs_forecast_lock",
  "caf_approved": "caf_approved", "mos_af": "mos_af", "cluster_acceptance_af": "cluster_acceptance_af",
  "ic_000040_af": "ic_000040_af", "patp_accepted_af": "patp_accepted_af",
};

function mapRow(row: Record<string, unknown>): Record<string, unknown> | null {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const dbCol = HEADER_TO_DB[key] ?? HEADER_TO_DB[normalizeHeader(key)];
    if (!dbCol) continue;
    let v = value === "" || value === undefined ? null : value;
    if (DATE_COLUMNS.has(dbCol)) {
      v = parseDate(v);
    } else if (NUMERIC_COLUMNS.has(dbCol) && v !== null) {
      const n = Number(v);
      v = isNaN(n) ? null : n;
    } else if (typeof v === "string") {
      v = v.trim() || null;
    }
    out[dbCol] = v;
  }
  const sk = (out.system_key ?? row.system_key ?? row.systemkey) as string;
  if (!sk || String(sk).trim() === "") return null;
  out.system_key = String(sk).trim();
  return out;
}

function parseExcel(buffer: Uint8Array): Record<string, unknown>[] {
  const wb = XLSX.read(buffer, { type: "array", cellDates: false, raw: true });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet || !sheet["!ref"]) throw new Error("Empty or invalid sheet");
  const rows = XLSX.utils.sheet_to_json(sheet, { raw: true, header: 1, defval: null }) as unknown[][];
  if (rows.length < 2) throw new Error("Need at least header row (row 2)");
  const headers = (rows[1] as unknown[]).map((h, i) => String(h ?? "").trim() || `Column_${i + 1}`);
  const out: Record<string, unknown>[] = [];
  for (let i = 2; i < rows.length; i++) {
    const row = rows[i] as unknown[];
    if (!row?.some((c) => c !== null && c !== undefined && c !== "")) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, j) => {
      const v = row[j];
      obj[h] = v === "" || v === undefined ? null : v;
    });
    out.push(obj);
  }
  return out;
}

function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Content-Type": "application/json",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ success: false, message: "Method not allowed" }),
      { status: 405, headers: corsHeaders() }
    );
  }

  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return new Response(
        JSON.stringify({ success: false, message: "No file provided. Use form-data key 'file'." }),
        { status: 400, headers: corsHeaders() }
      );
    }
    if (file.size > MAX_FILE_SIZE) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `File too large (${(file.size / 1024).toFixed(0)}KB). Max 1MB for Edge Function. Use Next.js API for larger: POST /api/hermes-5g/upload-excel`,
        }),
        { status: 413, headers: corsHeaders() }
      );
    }
    const buf = new Uint8Array(await file.arrayBuffer());
    let rows: Record<string, unknown>[];
    try {
      rows = parseExcel(buf);
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: `Parse error: ${e instanceof Error ? e.message : String(e)}` }),
        { status: 400, headers: corsHeaders() }
      );
    }
    if (rows.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No data rows (row 3+)" }),
        { status: 400, headers: corsHeaders() }
      );
    }
    if (rows.length > MAX_ROWS) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Too many rows (${rows.length}). Edge Function limit ${MAX_ROWS} rows. Split file or use Next.js API: POST /api/hermes-5g/upload-excel`,
        }),
        { status: 413, headers: corsHeaders() }
      );
    }

    const mapped: Record<string, unknown>[] = [];
    const errors: { row: number; error: string }[] = [];
    for (let i = 0; i < rows.length; i++) {
      const row = mapRow(rows[i]);
      if (!row) {
        errors.push({ row: i + 3, error: "Missing or empty system_key" });
        continue;
      }
      mapped.push(row);
    }

    if (mapped.length === 0) {
      return new Response(
        JSON.stringify({ success: false, message: "No valid rows", errors }),
        { status: 400, headers: corsHeaders() }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    let inserted = 0;
    for (let i = 0; i < mapped.length; i += BATCH_SIZE) {
      const batch = mapped.slice(i, i + BATCH_SIZE);
      const { error } = await supabase
        .from("site_data_5g")
        .upsert(batch, { onConflict: "system_key", ignoreDuplicates: false });
      if (error) {
        errors.push({ row: i + 3, error: error.message });
      } else {
        inserted += batch.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        totalRows: rows.length,
        insertedCount: inserted,
        errorCount: errors.length,
        errors: errors.slice(0, 50),
      }),
      { status: 200, headers: corsHeaders() }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({
        success: false,
        message: err instanceof Error ? err.message : String(err),
      }),
      { status: 500, headers: corsHeaders() }
    );
  }
});
