'use client'

import type { Address } from 'viem'
import { isAddress } from 'viem'
import { z } from 'zod'
import type { EncryptedWalletBlob, LocalWalletRecord } from '@/lib/client-wallet/types'
import { encryptedBlobSchema } from '@/lib/aa/validation'

export const WALLET_BACKUP_FORMAT = 'decleanup-wallet-backup' as const
export const WALLET_BACKUP_VERSION = 2 as const

/** Portable encrypted wallet backup — safe to store in cloud/USB; useless without unlock password. */
export type WalletBackupFile = {
  format: typeof WALLET_BACKUP_FORMAT
  version: typeof WALLET_BACKUP_VERSION
  exportedAt: string
  eoaAddress: Address
  smartAccountAddress: Address
  chainId: number
  encryptedBlob: EncryptedWalletBlob
  checksum: string
}

const legacyBackupSchema = z.object({
  version: z.literal(1).optional(),
  exportedAt: z.string().optional(),
  eoaAddress: z.string().optional(),
  smartAccountAddress: z.string().optional(),
  encryptedBlob: encryptedBlobSchema,
  chainId: z.number().optional(),
})

const v2BackupSchema = z.object({
  format: z.literal(WALLET_BACKUP_FORMAT),
  version: z.literal(WALLET_BACKUP_VERSION),
  exportedAt: z.string(),
  eoaAddress: z.string(),
  smartAccountAddress: z.string(),
  chainId: z.number(),
  encryptedBlob: encryptedBlobSchema,
  checksum: z.string().optional(),
})

async function sha256Hex(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

export async function computeBackupChecksum(params: {
  eoaAddress: string
  smartAccountAddress: string
  encryptedBlob: EncryptedWalletBlob
}): Promise<string> {
  const payload = `${params.eoaAddress.toLowerCase()}|${params.smartAccountAddress.toLowerCase()}|${params.encryptedBlob.encryptedData}`
  return sha256Hex(payload)
}

export async function createWalletBackupFile(
  record: Pick<
    LocalWalletRecord,
    'address' | 'smartAccountAddress' | 'encryptedBlob' | 'chainId'
  >
): Promise<WalletBackupFile> {
  const checksum = await computeBackupChecksum({
    eoaAddress: record.address,
    smartAccountAddress: record.smartAccountAddress,
    encryptedBlob: record.encryptedBlob,
  })
  return {
    format: WALLET_BACKUP_FORMAT,
    version: WALLET_BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    eoaAddress: record.address,
    smartAccountAddress: record.smartAccountAddress,
    chainId: record.chainId,
    encryptedBlob: record.encryptedBlob,
    checksum,
  }
}

export function downloadWalletBackupFile(backup: WalletBackupFile): void {
  const json = JSON.stringify(backup, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const stamp = new Date(backup.exportedAt).toISOString().slice(0, 10)
  const short = backup.eoaAddress.slice(2, 8)
  const a = document.createElement('a')
  a.href = url
  a.download = `decleanup-wallet-backup-${stamp}-${short}.json`
  a.click()
  URL.revokeObjectURL(url)
}

export type ParsedWalletBackup =
  | { ok: true; backup: WalletBackupFile }
  | { ok: false; error: string }

export async function parseWalletBackupFile(raw: unknown): Promise<ParsedWalletBackup> {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Invalid backup file.' }
  }

  const v2 = v2BackupSchema.safeParse(raw)
  if (v2.success) {
    const data = v2.data
    if (!isAddress(data.eoaAddress) || !isAddress(data.smartAccountAddress)) {
      return { ok: false, error: 'Backup contains invalid addresses.' }
    }
    const backup: WalletBackupFile = {
      format: WALLET_BACKUP_FORMAT,
      version: WALLET_BACKUP_VERSION,
      exportedAt: data.exportedAt,
      eoaAddress: data.eoaAddress as Address,
      smartAccountAddress: data.smartAccountAddress as Address,
      chainId: data.chainId,
      encryptedBlob: data.encryptedBlob,
      checksum: data.checksum ?? '',
    }
    if (data.checksum) {
      const expected = await computeBackupChecksum({
        eoaAddress: backup.eoaAddress,
        smartAccountAddress: backup.smartAccountAddress,
        encryptedBlob: backup.encryptedBlob,
      })
      if (data.checksum !== expected) {
        return { ok: false, error: 'Backup checksum mismatch — file may be corrupted.' }
      }
    }
    return { ok: true, backup }
  }

  const legacy = legacyBackupSchema.safeParse(raw)
  if (legacy.success) {
    const d = legacy.data
    if (!d.eoaAddress || !d.smartAccountAddress || !isAddress(d.eoaAddress) || !isAddress(d.smartAccountAddress)) {
      return { ok: false, error: 'Legacy backup is missing wallet addresses.' }
    }
    const backup = await createWalletBackupFile({
      address: d.eoaAddress as Address,
      smartAccountAddress: d.smartAccountAddress as Address,
      encryptedBlob: d.encryptedBlob,
      chainId: d.chainId ?? 11142220,
    })
    backup.exportedAt = d.exportedAt ?? backup.exportedAt
    return { ok: true, backup }
  }

  return { ok: false, error: 'Unrecognized backup format.' }
}

export async function readWalletBackupFromFile(file: File): Promise<ParsedWalletBackup> {
  try {
    const text = await file.text()
    const json = JSON.parse(text) as unknown
    return parseWalletBackupFile(json)
  } catch {
    return { ok: false, error: 'Could not read backup file. Ensure it is valid JSON.' }
  }
}
