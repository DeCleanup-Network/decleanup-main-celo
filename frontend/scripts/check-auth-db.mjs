/**
 * Run: npm run db:check
 * Verifies DATABASE_URL and Auth.js Prisma tables (User, Account, Session).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const candidates = [
    resolve(frontendRoot, '.env.local'),
    resolve(process.cwd(), '.env.local'),
  ]
  const path = candidates.find((p) => {
    try {
      readFileSync(p)
      return true
    } catch {
      return false
    }
  })
  if (!path) {
    console.error('No .env.local found. Tried:')
    for (const p of candidates) console.error('  ', p)
    console.error('\nRun from frontend/:  cd frontend && npm run db:check')
    process.exit(1)
  }
  try {
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
      if ((key === 'DATABASE_URL' || key === 'DIRECT_URL') && /^postgres(ql)?:\/\//i.test(val)) {
        try {
          const u = new URL(val)
          if (!u.searchParams.has('sslmode') && !val.includes('pgbouncer=true')) {
            u.searchParams.set('sslmode', 'require')
          }
          val = u.toString()
        } catch {
          console.error(`Invalid ${key} in .env.local (check for missing @ before host)`)
          process.exit(1)
        }
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch (e) {
    console.error('Failed to read', path, e.message)
    process.exit(1)
  }
}

loadEnvLocal()

const url = process.env.DATABASE_URL?.trim()
if (!url) {
  console.error('FAIL: DATABASE_URL is missing')
  process.exit(1)
}
if (!/^postgres(ql)?:\/\//i.test(url)) {
  console.error('FAIL: DATABASE_URL must start with postgresql://')
  process.exit(1)
}

const isLocal = url.includes('127.0.0.1') || url.includes('localhost')
const pgUrl = new URL(url)
if (!isLocal) {
  pgUrl.searchParams.delete('sslmode')
}
const connectionString = pgUrl.toString()

const pool = new pg.Pool({
  connectionString,
  max: 1,
  connectionTimeoutMillis: 15_000,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

try {
  const client = await pool.connect()
  console.log('OK: Connected to database (Node pg driver)')

  const tables = await client.query(`
    SELECT table_name FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name IN ('User', 'Account', 'Session')
    ORDER BY table_name
  `)
  const names = tables.rows.map((r) => r.table_name)
  console.log('Auth tables found:', names.length ? names.join(', ') : '(none)')

  if (!names.includes('User')) {
    console.error('\nFAIL: User table missing.')
    console.error('  Local: docker compose -f docker-compose.db.yml up -d && npm run db:local:push')
    console.error('  Supabase: SQL Editor → run prisma/supabase-full-schema.sql')
    process.exit(1)
  }

  const users = await client.query('SELECT COUNT(*)::int AS n FROM "User"')
  console.log(`OK: User table readable (${users.rows[0].n} users)`)
  client.release()
} catch (e) {
  console.error('\nFAIL:', e.message)
  if (e.message?.includes('password authentication failed')) {
    console.error('\nWrong database password. Reset in Supabase → Database → Reset password.')
    console.error('Then: npm run db:pooler-url  and paste Option A into .env.local')
  } else if (e.message?.includes("Can't reach") || e.code === 'ECONNREFUSED' || e.code === 'ETIMEDOUT') {
    console.error(`
Cannot reach Supabase from this Mac. Use local Postgres for dev:

  cd frontend
  docker compose -f docker-compose.db.yml up -d
  npm run db:local:push

That sets DATABASE_URL to localhost:5433 and creates all tables.
`)
  }
  process.exit(1)
} finally {
  await pool.end()
}
