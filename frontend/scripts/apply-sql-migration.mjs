/**
 * Run one SQL migration file against Postgres (DIRECT_URL or DATABASE_URL from .env.local).
 * Use when `supabase db push` fails with cli_login_postgres / CREATEROLE errors.
 *
 *   node scripts/apply-sql-migration.mjs supabase/migrations/20260519_create_airdrop_issued_store.sql
 */

import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const frontendRoot = resolve(__dirname, '..')
const envPath = resolve(frontendRoot, '.env.local')

function loadEnvLocal() {
  if (!existsSync(envPath)) return
  for (const line of readFileSync(envPath, 'utf8').split(/\r?\n/)) {
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

async function main() {
  loadEnvLocal()
  const rel = process.argv[2]
  if (!rel) {
    console.error('Usage: node scripts/apply-sql-migration.mjs <path-to.sql>')
    process.exit(1)
  }

  const sqlPath = resolve(frontendRoot, rel)
  if (!existsSync(sqlPath)) {
    console.error(`File not found: ${sqlPath}`)
    process.exit(1)
  }

  const url = process.env.DIRECT_URL?.trim() || process.env.DATABASE_URL?.trim()
  if (!url?.startsWith('postgres')) {
    console.error('Set DIRECT_URL or DATABASE_URL in frontend/.env.local (direct connection, not pooler).')
    process.exit(1)
  }

  const pgUrl = new URL(url)
  pgUrl.searchParams.delete('pgbouncer')

  const sql = readFileSync(sqlPath, 'utf8')
  const pool = new pg.Pool({
    connectionString: pgUrl.toString(),
    ssl: { rejectUnauthorized: false },
  })

  try {
    await pool.query(sql)
    console.log(`Applied: ${rel}`)
  } catch (e) {
    console.error('Migration failed:', e?.message ?? e)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
