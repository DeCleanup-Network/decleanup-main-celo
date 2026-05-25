/**
 * Run a command with .env.local loaded (Prisma CLI only reads .env by default).
 * Usage: node scripts/with-env-local.mjs prisma db push
 */
import { readFileSync } from 'node:fs'
import { spawnSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  resolve(frontendRoot, '.env.local'),
  resolve(process.cwd(), '.env.local'),
]
const envPath = candidates.find((p) => {
  try {
    readFileSync(p)
    return true
  } catch {
    return false
  }
})
if (!envPath) {
  console.error('Missing .env.local. Run: cd frontend && npm run db:check')
  process.exit(1)
}
try {
  const text = readFileSync(envPath, 'utf8')
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
    // Fix accidental duplicate key prefixes in value
    while (val.startsWith(`${key}=`)) val = val.slice(key.length + 1)
    if ((key === 'DATABASE_URL' || key === 'DIRECT_URL') && /^postgres(ql)?:\/\//i.test(val)) {
      const u = new URL(val)
      if (!u.searchParams.has('sslmode')) u.searchParams.set('sslmode', 'require')
      val = u.toString()
    }
    process.env[key] = val
  }
} catch (e) {
  console.error('Failed to read', envPath, e.message)
  process.exit(1)
}

const [cmd, ...args] = process.argv.slice(2)
if (!cmd) {
  console.error('Usage: node scripts/with-env-local.mjs <command> [args...]')
  process.exit(1)
}

const result = spawnSync(cmd, args, { stdio: 'inherit', env: process.env, shell: false })
process.exit(result.status ?? 1)
