import 'server-only'
import type { Address } from 'viem'
import type { Prisma } from '@prisma/client'
import { prisma } from '@/lib/db/prisma'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import type { EncryptedWalletBlob } from '@/lib/client-wallet/types'

export type WalletMetadata = {
  address: Address
  smartAccountAddress: Address
  chainId: number
  walletVersion: number
}

/** Server never decrypts — stores opaque blob from client. */
export async function upsertWalletMetadata(params: {
  userId: string
  address: Address
  smartAccountAddress: Address
  encryptedBlob: EncryptedWalletBlob
  chainId?: number
}): Promise<WalletMetadata> {
  const chainId = params.chainId ?? REQUIRED_CHAIN_ID
  const row = await prisma.userWallet.upsert({
    where: { userId: params.userId },
    create: {
      userId: params.userId,
      address: params.address.toLowerCase(),
      smartAccountAddress: params.smartAccountAddress.toLowerCase(),
      encryptedBlob: params.encryptedBlob as unknown as Prisma.InputJsonValue,
      chainId,
      walletVersion: 2,
    },
    update: {
      address: params.address.toLowerCase(),
      smartAccountAddress: params.smartAccountAddress.toLowerCase(),
      encryptedBlob: params.encryptedBlob as unknown as Prisma.InputJsonValue,
      chainId,
      walletVersion: 2,
    },
  })
  return {
    address: row.address as Address,
    smartAccountAddress: row.smartAccountAddress as Address,
    chainId: row.chainId,
    walletVersion: row.walletVersion,
  }
}

export async function findWalletByUserId(userId: string) {
  return prisma.userWallet.findUnique({ where: { userId } })
}

export async function findWalletMetadata(userId: string): Promise<WalletMetadata | null> {
  const row = await findWalletByUserId(userId)
  if (!row) return null
  return {
    address: row.address as Address,
    smartAccountAddress: row.smartAccountAddress as Address,
    chainId: row.chainId,
    walletVersion: row.walletVersion,
  }
}
