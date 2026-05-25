import 'server-only'
import type { AuthenticatorTransportFuture } from '@simplewebauthn/server'
import type { WebAuthnCredential } from '@simplewebauthn/server'
import { prisma } from '@/lib/db/prisma'

export async function listPasskeyCredentials(userId: string) {
  return prisma.passkeyCredential.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      credentialID: true,
      deviceType: true,
      backedUp: true,
      createdAt: true,
    },
  })
}

export async function countPasskeyCredentials(userId: string): Promise<number> {
  return prisma.passkeyCredential.count({ where: { userId } })
}

export async function findPasskeyByCredentialId(credentialID: string) {
  return prisma.passkeyCredential.findUnique({ where: { credentialID } })
}

export async function savePasskeyCredential(params: {
  userId: string
  credential: WebAuthnCredential
  deviceType?: string | null
  backedUp?: boolean | null
}) {
  const { credential, userId, deviceType, backedUp } = params
  const publicKey = Buffer.from(credential.publicKey).toString('base64url')
  return prisma.passkeyCredential.create({
    data: {
      userId,
      credentialID: credential.id,
      publicKey,
      counter: credential.counter,
      transports: credential.transports ?? undefined,
      deviceType: deviceType ?? null,
      backedUp: backedUp ?? null,
    },
  })
}

export async function updatePasskeyCounter(credentialID: string, counter: number) {
  return prisma.passkeyCredential.update({
    where: { credentialID },
    data: { counter },
  })
}

export async function deletePasskeyCredential(userId: string, credentialDbId: string) {
  return prisma.passkeyCredential.deleteMany({
    where: { id: credentialDbId, userId },
  })
}

export async function deleteAllPasskeysForUser(userId: string) {
  await prisma.passkeyCredential.deleteMany({ where: { userId } })
  await prisma.passkeyUnlockSecret.deleteMany({ where: { userId } })
}

export function toWebAuthnCredential(row: {
  credentialID: string
  publicKey: string
  counter: number
  transports: unknown
}): WebAuthnCredential {
  return {
    id: row.credentialID,
    publicKey: Buffer.from(row.publicKey, 'base64url'),
    counter: row.counter,
    transports: (row.transports as AuthenticatorTransportFuture[] | null) ?? undefined,
  }
}
