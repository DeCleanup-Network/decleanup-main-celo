/**
 * DeCleanup support: reset embedded wallet for a user who lost passkey + has no backup.
 *
 * Deletes server-side wallet metadata + passkeys. User keeps same email login; next sign-in
 * creates a NEW smart account (old onchain address is not recovered).
 *
 * Usage (from frontend/):
 *   node scripts/reset-user-wallet.mjs --smart-account 0x7cd1...        # preview
 *   node scripts/reset-user-wallet.mjs --email user@example.com           # preview
 *   node scripts/reset-user-wallet.mjs --smart-account 0x7cd1... --confirm
 *
 * Requires DATABASE_URL in .env.local (production Supabase pooler URL).
 */
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

function loadEnvLocal() {
  const path = resolve(frontendRoot, '.env.local')
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
      if ((key === 'DATABASE_URL' || key === 'DIRECT_URL') && /^postgres(ql)?:\/\//i.test(val)) {
        try {
          const u = new URL(val)
          if (!u.searchParams.has('sslmode') && !val.includes('pgbouncer=true')) {
            u.searchParams.set('sslmode', 'require')
          }
          val = u.toString()
        } catch {
          /* ignore */
        }
      }
      if (!process.env[key]) process.env[key] = val
    }
  } catch {
    console.error('Missing frontend/.env.local with DATABASE_URL')
    process.exit(1)
  }
}

function parseArgs(argv) {
  let smartAccount = ''
  let email = ''
  let confirm = false
  let list = false
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]
    if (a === '--smart-account' || a === '--sa') smartAccount = (argv[++i] || '').trim()
    else if (a === '--email') email = (argv[++i] || '').trim()
    else if (a === '--confirm') confirm = true
    else if (a === '--list') list = true
    else if (a === '--help' || a === '-h') {
      console.log(`Usage:
  node scripts/reset-user-wallet.mjs --list
  node scripts/reset-user-wallet.mjs --smart-account 0x... [--confirm]
  node scripts/reset-user-wallet.mjs --email user@example.com [--confirm]`)
      process.exit(0)
    }
  }
  return { smartAccount, email, confirm, list }
}

function normalizeAddr(v) {
  const t = v.trim().toLowerCase()
  if (!/^0x[a-f0-9]{40}$/.test(t)) {
    console.error('Invalid address (expected 0x + 40 hex chars):', v)
    process.exit(1)
  }
  return t
}

loadEnvLocal()

const { smartAccount, email, confirm, list } = parseArgs(process.argv.slice(2))
if (!smartAccount && !email && !list) {
  console.error('Provide --list, --smart-account 0x..., or --email user@example.com')
  process.exit(1)
}

const url = process.env.DATABASE_URL?.trim()
if (!url?.startsWith('postgres')) {
  console.error('DATABASE_URL missing or invalid in .env.local')
  process.exit(1)
}

const isLocal = url.includes('127.0.0.1') || url.includes('localhost')
const pgUrl = new URL(url)
if (!isLocal) pgUrl.searchParams.delete('sslmode')

const pool = new pg.Pool({
  connectionString: pgUrl.toString(),
  max: 1,
  connectionTimeoutMillis: 20_000,
  ssl: isLocal ? false : { rejectUnauthorized: false },
})

const client = await pool.connect()

try {
  if (list) {
    const res = await client.query(
      `SELECT u.email, w."smartAccountAddress", w.address, w."userId"
       FROM "UserWallet" w
       JOIN "User" u ON u.id = w."userId"
       ORDER BY w."updatedAt" DESC`
    )
    console.log(`UserWallet rows: ${res.rows.length}\n`)
    for (const row of res.rows) {
      console.log(row.email || '(no email)')
      console.log('  smart account:', row.smartAccountAddress)
      console.log('  signer:       ', row.address)
      console.log('  userId:       ', row.userId)
      console.log('')
    }
    process.exit(0)
  }

  let userId = ''
  let userEmail = ''
  let walletRow = null

  if (smartAccount) {
    const sa = normalizeAddr(smartAccount)
    const res = await client.query(
      `SELECT w."userId", w.address, w."smartAccountAddress", u.email
       FROM "UserWallet" w
       JOIN "User" u ON u.id = w."userId"
       WHERE lower(w."smartAccountAddress") = $1
       LIMIT 1`,
      [sa]
    )
    if (!res.rows.length) {
      console.error('No UserWallet found for smart account:', sa)
      process.exit(1)
    }
    walletRow = res.rows[0]
    userId = walletRow.userId
    userEmail = walletRow.email || ''
  } else {
    const res = await client.query(`SELECT id, email FROM "User" WHERE lower(email) = lower($1) LIMIT 1`, [
      email.trim(),
    ])
    if (!res.rows.length) {
      console.error('No User found for email:', email)
      process.exit(1)
    }
    userId = res.rows[0].id
    userEmail = res.rows[0].email || email
    const w = await client.query(`SELECT address, "smartAccountAddress" FROM "UserWallet" WHERE "userId" = $1`, [
      userId,
    ])
    walletRow = w.rows[0] || null
  }

  const passkeys = await client.query(`SELECT COUNT(*)::int AS n FROM "PasskeyCredential" WHERE "userId" = $1`, [
    userId,
  ])

  console.log('--- Wallet reset preview ---')
  console.log('userId:           ', userId)
  console.log('email:            ', userEmail || '(none)')
  if (walletRow) {
    console.log('signer (EOA):     ', walletRow.address)
    console.log('smart account:    ', walletRow.smartAccountAddress)
  } else {
    console.log('UserWallet:       (none — nothing to delete)')
  }
  console.log('passkey creds:    ', passkeys.rows[0].n)

  if (!walletRow) {
    console.log('\nNothing to reset.')
    process.exit(0)
  }

  if (!confirm) {
    console.log('\nDry run only. Re-run with --confirm to delete wallet + passkeys for this user.')
    console.log('User must sign in again and set a new wallet passkey (new smart account address).')
    process.exit(0)
  }

  await client.query('BEGIN')
  await client.query(`DELETE FROM "WebAuthnChallenge" WHERE "userId" = $1`, [userId])
  await client.query(`DELETE FROM "PasskeyCredential" WHERE "userId" = $1`, [userId])
  await client.query(`DELETE FROM "PasskeyUnlockSecret" WHERE "userId" = $1`, [userId])
  await client.query(`DELETE FROM "UserWallet" WHERE "userId" = $1`, [userId])
  await client.query('COMMIT')

  console.log('\nOK: Wallet reset complete for', userEmail || userId)
  console.log('Tell the user to sign in at dapp.decleanup.net, create a new wallet passkey, and note the new smart account address.')
  console.log('Old address', walletRow.smartAccountAddress, 'remains onchain; cleanups there are not moved.')
} catch (e) {
  try {
    await client.query('ROLLBACK')
  } catch {
    /* ignore */
  }
  console.error('FAIL:', e.message)
  process.exit(1)
} finally {
  client.release()
  await pool.end()
}
