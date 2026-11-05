#!/usr/bin/env node
/**
 * Copy all public table rows from Supabase Cloud into local Postgres.
 */
import { createClient } from '@supabase/supabase-js'
import pg from 'pg'

const SOURCE_URL = process.env.SOURCE_SUPABASE_URL
const SOURCE_KEY = process.env.SOURCE_SUPABASE_KEY || process.env.SOURCE_SUPABASE_ANON_KEY
const DATABASE_URL = process.env.DATABASE_URL

if (!SOURCE_URL || !SOURCE_KEY || !DATABASE_URL) {
  console.error('Need SOURCE_SUPABASE_URL, SOURCE_SUPABASE_KEY, DATABASE_URL')
  process.exit(1)
}

const TABLES = [
  'site_data',
  'site_data_5g',
  'site_data_aop',
  'site_data_tlp',
  'site_data_caf',
  'site_data_cme',
  'site_data_prio',
  'site_data_sanitation_report',
  'aop_filter_templates',
]

const PAGE = 500
const source = createClient(SOURCE_URL, SOURCE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
})
const pool = new pg.Pool({ connectionString: DATABASE_URL })

function quoteIdent(name) {
  return `"${String(name).replace(/"/g, '""')}"`
}

async function migrateTable(table) {
  const client = await pool.connect()
  try {
    const { rows: cols } = await client.query(
      `SELECT column_name, data_type, udt_name
       FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND is_generated='NEVER'
       ORDER BY ordinal_position`,
      [table],
    )
    if (!cols.length) {
      console.log(`SKIP ${table}: no target columns`)
      return { table, copied: 0 }
    }
    const colNames = cols.map((c) => c.column_name)

    await client.query('BEGIN')
    await client.query(`TRUNCATE TABLE ${quoteIdent(table)} CASCADE`)

    let from = 0
    let copied = 0
    for (;;) {
      const to = from + PAGE - 1
      const { data, error } = await source.from(table).select('*').range(from, to)
      if (error) throw new Error(`${table} fetch ${from}-${to}: ${error.message}`)
      if (!data || data.length === 0) break

      const payload = data.map((row) => {
        const obj = {}
        for (const col of colNames) {
          let v = row[col]
          if (v !== null && typeof v === 'object' && !(v instanceof Date)) {
            v = JSON.stringify(v)
          }
          obj[col] = v === undefined ? null : v
        }
        return obj
      })

      // Single JSON param avoids Postgres bind-parameter limits on wide tables
      const colList = colNames.map(quoteIdent).join(',')
      const selectList = colNames.map((c) => quoteIdent(c)).join(',')
      const sql = `
        INSERT INTO ${quoteIdent(table)} (${colList})
        OVERRIDING SYSTEM VALUE
        SELECT ${selectList}
        FROM json_populate_recordset(NULL::${quoteIdent(table)}, $1::json)
        ON CONFLICT DO NOTHING`
      await client.query(sql, [JSON.stringify(payload)])

      copied += data.length
      process.stdout.write(`\r${table}: ${copied}`)
      if (data.length < PAGE) break
      from += PAGE
    }
    await client.query('COMMIT')
    console.log(`\nOK ${table}: ${copied}`)
    return { table, copied }
  } catch (e) {
    await client.query('ROLLBACK').catch(() => {})
    throw e
  } finally {
    client.release()
  }
}

async function main() {
  const results = []
  for (const t of TABLES) {
    results.push(await migrateTable(t))
  }
  for (const t of TABLES) {
    const { count, error } = await source.from(t).select('*', { count: 'exact', head: true })
    const local = await pool.query(`SELECT COUNT(*)::int AS c FROM ${quoteIdent(t)}`)
    console.log(`VERIFY ${t}: source=${error ? error.message : count} local=${local.rows[0].c}`)
  }
  await pool.end()
  console.log(JSON.stringify(results, null, 2))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
