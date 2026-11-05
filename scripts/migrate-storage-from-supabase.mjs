#!/usr/bin/env node
/**
 * List + download objects from Supabase Storage bucket hermes-5g-uploads to local dir.
 * Requires SOURCE_SUPABASE_URL + SOURCE_SUPABASE_SERVICE_ROLE_KEY (service role for listing).
 * If listing fails without service role, creates empty destination folder.
 */
import { createClient } from '@supabase/supabase-js'
import { promises as fs } from 'fs'
import path from 'path'

const URL = process.env.SOURCE_SUPABASE_URL
const KEY = process.env.SOURCE_SUPABASE_SERVICE_ROLE_KEY || process.env.SOURCE_SUPABASE_KEY
const OUT = process.env.UPLOADS_OUT || '/opt/project-dashboard/data/uploads/hermes-5g-uploads'
const BUCKET = 'hermes-5g-uploads'

if (!URL || !KEY) {
  console.error('Need SOURCE_SUPABASE_URL and SOURCE_SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(URL, KEY)

async function listAll(prefix = '') {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 })
  if (error) throw error
  const files = []
  for (const item of data || []) {
    const full = prefix ? `${prefix}/${item.name}` : item.name
    if (item.id === null && !item.metadata) {
      // folder
      files.push(...(await listAll(full)))
    } else {
      files.push(full)
    }
  }
  return files
}

async function main() {
  await fs.mkdir(OUT, { recursive: true })
  let files = []
  try {
    files = await listAll('')
  } catch (e) {
    console.warn('Storage list failed (bucket empty or no service role):', e.message || e)
    console.log('Created empty', OUT)
    return
  }
  console.log('Found', files.length, 'objects')
  for (const filePath of files) {
    const { data, error } = await supabase.storage.from(BUCKET).download(filePath)
    if (error) {
      console.warn('skip', filePath, error.message)
      continue
    }
    const dest = path.join(OUT, filePath)
    await fs.mkdir(path.dirname(dest), { recursive: true })
    const buf = Buffer.from(await data.arrayBuffer())
    await fs.writeFile(dest, buf)
    console.log('saved', filePath, buf.length)
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
