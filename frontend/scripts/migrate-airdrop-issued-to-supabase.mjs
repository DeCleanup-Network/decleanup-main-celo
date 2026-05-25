/**
 * One-time migration: copy local `airdrop-issued.json` into Supabase `airdrop_issued_store`.
 *
 * Apply migration `20260519_create_airdrop_issued_store.sql` first.
 *
 * Usage (from repo root):
 *   node frontend/scripts/migrate-airdrop-issued-to-supabase.mjs
 *
 * Optional:
 *   AIRDROP_ISSUED_STORE_PATH  Override input JSON path.
 *   DRY_RUN=1                  Print rows only.
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const envPath = resolve(frontendRoot, '.env.local')

function loadDotLocal() {
  if (!existsSync(envPath)) return
  const text = readFileSync(envPath, 'utf8')
  for (const line of text.split(/\r?\n/)) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const eq = t.indexOf('=')
    if (eq === -1) continue
    const k = t.slice(0, eq).trim()
    let v = t.slice(eq + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (process.env[k] === undefined) process.env[k] = v
  }
}

function defaultJsonPath() {
  return process.env.AIRDROP_ISSUED_STORE_PATH || resolve(frontendRoot, 'data', 'airdrop-issued.json')
}

async function main() {
  loadDotLocal()

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim()

  if (!url || !key) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY.')
    process.exit(1)
  }

  const jsonPath = defaultJsonPath()
  if (!existsSync(jsonPath)) {
    console.log(`No local store at ${jsonPath} — nothing to migrate.`)
    return
  }

  let raw
  try {
    raw = JSON.parse(readFileSync(jsonPath, 'utf8'))
  } catch (e) {
    console.error(`Failed to parse ${jsonPath}:`, e?.message ?? e)
    process.exit(1)
  }

  const entries = Object.entries(raw || {}).filter(([, v]) => typeof v === 'string' && v.length > 0)
  if (entries.length === 0) {
    console.log('File store is empty. Nothing to do.')
    return
  }

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true'
  console.log(`Found ${entries.length} key(s) in ${jsonPath}. ${dryRun ? '(DRY RUN)' : ''}`)

  if (dryRun) {
    for (const [k, v] of entries) console.log(`  ${k} = ${v}`)
    return
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const rows = entries.map(([k, v]) => ({ key: k, value: v }))
  const { error } = await supabase.from('airdrop_issued_store').upsert(rows, { onConflict: 'key' })

  if (error) {
    console.error('Upsert failed:', error.message)
    process.exit(1)
  }

  console.log(`Upserted ${rows.length} row(s) into public.airdrop_issued_store.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
