import 'server-only'

import { prisma } from '@/lib/db/prisma'

const TTL_MS = 5 * 60 * 1000
const IDENTIFIER_PREFIX = 'wallet-nonce:'

function identifierFor(address: string): string {
  return `${IDENTIFIER_PREFIX}${address.toLowerCase()}`
}

/**
 * Issue a one-time nonce for wallet SIWE sign-in.
 * Stored in Postgres so dev hot-reload / serverless does not drop the challenge.
 */
export async function issueWalletNonce(address: string): Promise<string> {
  const nonce = crypto.randomUUID().replace(/-/g, '')
  const identifier = identifierFor(address)
  const expires = new Date(Date.now() + TTL_MS)

  await prisma.verificationToken.deleteMany({ where: { identifier } })
  await prisma.verificationToken.create({
    data: { identifier, token: nonce, expires },
  })

  return nonce
}

export async function consumeWalletNonce(address: string, nonce: string): Promise<boolean> {
  const identifier = identifierFor(address)
  const entry = await prisma.verificationToken.findUnique({
    where: { identifier_token: { identifier, token: nonce } },
  })

  if (!entry || entry.expires < new Date()) {
    await prisma.verificationToken.deleteMany({ where: { identifier, token: nonce } })
    return false
  }

  await prisma.verificationToken.delete({
    where: { identifier_token: { identifier, token: nonce } },
  })
  return true
}
