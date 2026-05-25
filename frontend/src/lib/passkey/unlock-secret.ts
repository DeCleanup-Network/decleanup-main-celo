import 'server-only'
import { randomBytes } from 'node:crypto'
import { prisma } from '@/lib/db/prisma'

/** Per-user secret for wrapping unlock password client-side after passkey proof. */
export async function getOrCreatePasskeyUnlockSecret(userId: string): Promise<string> {
  const existing = await prisma.passkeyUnlockSecret.findUnique({ where: { userId } })
  if (existing) return existing.secret

  const secret = randomBytes(32).toString('base64url')
  await prisma.passkeyUnlockSecret.create({
    data: { userId, secret },
  })
  return secret
}

export async function getPasskeyUnlockSecret(userId: string): Promise<string | null> {
  const row = await prisma.passkeyUnlockSecret.findUnique({ where: { userId } })
  return row?.secret ?? null
}

export async function deletePasskeyUnlockSecret(userId: string): Promise<void> {
  await prisma.passkeyUnlockSecret.deleteMany({ where: { userId } })
}
