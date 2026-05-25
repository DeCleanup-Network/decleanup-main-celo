/**
 * Prints a Session pooler DATABASE_URL (port 6543) using the password from .env.local.
 * Direct db.*.supabase.co:5432 is often unreachable from home networks.
 *
 * Run: node scripts/print-pooler-database-url.mjs
 * Copy the output into .env.local as DATABASE_URL=...
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const envPath = resolve(dirname(fileURLToPath(import.meta.url)), '..', '.env.local')
const text = readFileSync(envPath, 'utf8')
const line = text.split('\n').find((l) => l.startsWith('DATABASE_URL='))
if (!line) {
  console.error('No DATABASE_URL in .env.local')
  process.exit(1)
}

let val = line.slice('DATABASE_URL='.length).trim()
if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
  val = val.slice(1, -1)
}
while (val.startsWith('DATABASE_URL=')) val = val.slice('DATABASE_URL='.length)

let u
try {
  u = new URL(val)
} catch {
  console.error('DATABASE_URL is not a valid URL')
  process.exit(1)
}

const hostMatch = u.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i)
const projectRef = hostMatch?.[1] ?? 'dhykmgtynlctpdpbznqj'
/** Supabase pooler host prefix: aws-0 or aws-1 — copy from Dashboard → Connect if unsure */
const poolerPrefix = process.env.SUPABASE_POOLER_PREFIX ?? 'aws-1'
const region = process.env.SUPABASE_POOLER_REGION ?? 'us-east-2'
const password = encodeURIComponent(u.password)

if (!u.password) {
  console.error('No password in DATABASE_URL')
  process.exit(1)
}

// Session pooler (5432) — copy this exact URI from Supabase Dashboard → Database → Connect if unsure
const sessionPooler = `postgresql://postgres.${projectRef}:${password}@${poolerPrefix}-${region}.pooler.supabase.com:5432/postgres?sslmode=require`
// Transaction pooler (6543) — alternative if session mode fails
const txnPooler = `postgresql://postgres.${projectRef}:${password}@${poolerPrefix}-${region}.pooler.supabase.com:6543/postgres?pgbouncer=true&sslmode=require`

const directUrl = `postgresql://postgres.${projectRef}:${password}@${poolerPrefix}-${region}.pooler.supabase.com:5432/postgres?sslmode=require`

console.log('\nPaste BOTH lines into .env.local (Supabase → Connect → ORM → Prisma):\n')
console.log('# Connection pooling (runtime)')
console.log(`DATABASE_URL="${txnPooler}"`)
console.log('\n# Direct / migrations (db push)')
console.log(`DIRECT_URL="${directUrl}"`)
console.log('\nOr copy exactly from Supabase Connect modal, then: npm run db:check && npm run db:push\n')
