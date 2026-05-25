/**
 * Apply prisma/supabase-full-schema.sql via Node pg (when Prisma CLI P1001 on DIRECT_URL).
 * Run: npm run db:apply-schema
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const path = resolve(frontendRoot, '.env.local')
  const text = readFileSync(path, 'utf8')
  for (const line of text.split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const key = t.slice(0, i).trim()
    let val = t.slice(i + 1).trim()
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1)
    }
    while (val.startsWith(`${key}=`)) val = val.slice(key.length + 1)
    process.env[key] = val
  }
}

loadEnvLocal()

const url = process.env.DIRECT_URL || process.env.DATABASE_URL
if (!url?.startsWith('postgres')) {
  console.error('Set DATABASE_URL and/or DIRECT_URL in .env.local')
  process.exit(1)
}

const pgUrl = new URL(url)
pgUrl.searchParams.delete('sslmode')
pgUrl.searchParams.delete('pgbouncer')

const sqlPath = resolve(frontendRoot, 'prisma/supabase-full-schema.sql')
const raw = readFileSync(sqlPath, 'utf8')
const sql = raw
  .split('\n')
  .filter((line) => !line.startsWith('npm ') && !line.includes('npm warn'))
  .join('\n')

const pool = new pg.Pool({
  connectionString: pgUrl.toString(),
  ssl: { rejectUnauthorized: false },
})

const client = await pool.connect()
try {
  console.log('Applying schema from prisma/supabase-full-schema.sql …')
  await client.query(sql)
  console.log('OK: Schema applied')
} catch (e) {
  if (e.message?.includes('already exists')) {
    console.log('OK: Tables already exist (skipped duplicates)')
  } else {
    console.error('FAIL:', e.message)
    process.exit(1)
  }
} finally {
  client.release()
  await pool.end()
}
