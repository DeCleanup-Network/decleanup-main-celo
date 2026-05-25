/**
 * One-time migration helper for legacy server-custodial wallets.
 *
 * Requires WALLET_ENCRYPTION_KEY (old server key) and DATABASE_URL.
 * Outputs per-user JSON files with decrypted private keys — handle securely and delete after users re-import.
 *
 * Usage:
 *   cd frontend && npx tsx scripts/migrate-custodial-wallets.ts
 *
 * Users should then visit /import-wallet with their exported key and set a new client unlock password.
 */

import { PrismaClient } from '@prisma/client'
import { createDecipheriv } from 'node:crypto'
import { writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

const prisma = new PrismaClient()

function getLegacyKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY?.trim()
  if (!raw) throw new Error('WALLET_ENCRYPTION_KEY required for legacy decrypt')
  const buf = Buffer.from(raw, 'hex')
  if (buf.length !== 32) throw new Error('WALLET_ENCRYPTION_KEY must be 64 hex chars')
  return buf
}

function decryptLegacy(ciphertext: string, iv: string, authTag: string, key: Buffer): string {
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'))
  decipher.setAuthTag(Buffer.from(authTag, 'hex'))
  const plain = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'hex')),
    decipher.final(),
  ])
  return plain.toString('utf8')
}

async function main() {
  const key = getLegacyKey()
  const outDir = join(process.cwd(), 'migration-exports')
  mkdirSync(outDir, { recursive: true })

  // Legacy schema columns — adjust if your DB still has them
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      userId: string
      eoaAddress: string
      smartAccountAddress: string
      encryptedPrivateKey: string
      iv: string
      authTag: string
    }>
  >(
    `SELECT "userId", "eoaAddress", "smartAccountAddress", "encryptedPrivateKey", iv, "authTag"
     FROM "UserWallet"
     WHERE "encryptedPrivateKey" IS NOT NULL
     LIMIT 500`
  ).catch(() => [])

  if (rows.length === 0) {
    console.log('No legacy custodial rows found (or schema already migrated).')
    console.log('If users already have encryptedBlob JSON, no server migration is needed.')
    return
  }

  for (const row of rows) {
    const privateKey = decryptLegacy(row.encryptedPrivateKey, row.iv, row.authTag, key)
    const payload = {
      userId: row.userId,
      eoaAddress: row.eoaAddress,
      smartAccountAddress: row.smartAccountAddress,
      privateKey,
      migratedAt: new Date().toISOString(),
      instructions:
        'User must import at /import-wallet with this private key, then delete this file.',
    }
    const file = join(outDir, `${row.userId}.json`)
    writeFileSync(file, JSON.stringify(payload, null, 2))
    console.log(`Exported ${file}`)
  }

  console.log(`Done. ${rows.length} file(s) in ${outDir}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
