import 'server-only'
import { prisma } from '@/lib/db/prisma'
import { isAddress } from 'viem'

export async function resolveUserIdByEmail(email: string): Promise<string | null> {
  const normalized = email.trim().toLowerCase()
  if (!normalized || !normalized.includes('@')) return null
  const user = await prisma.user.findFirst({
    where: { email: { equals: normalized, mode: 'insensitive' } },
    select: { id: true },
  })
  return user?.id ?? null
}

export async function resolveUserIdByWallet(wallet: string): Promise<string | null> {
  const addr = wallet.trim().toLowerCase()
  if (!isAddress(addr)) return null
  const row = await prisma.userWallet.findFirst({
    where: {
      OR: [
        { address: { equals: addr, mode: 'insensitive' } },
        { smartAccountAddress: { equals: addr, mode: 'insensitive' } },
      ],
    },
    select: { userId: true },
  })
  return row?.userId ?? null
}

export async function resolveUserEmail(userId: string): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, notifyEmail: true },
  })
  if (!user?.email || user.notifyEmail === false) return null
  return user.email
}
