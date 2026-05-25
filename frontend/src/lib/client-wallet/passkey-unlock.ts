'use client'

import type { EncryptedWalletBlob } from '@/lib/client-wallet/types'
import { decryptPrivateKey, encryptPrivateKey } from '@/lib/client-wallet/encryption'

const LS_PREFIX = 'decleanup-passkey-unlock:'

export type PasskeyUnlockRecord = {
  userId: string
  /** Unlock password encrypted with passkey unlock key (never plaintext). */
  encryptedUnlockPassword: EncryptedWalletBlob
  updatedAt: string
}

function storageKey(userId: string) {
  return `${LS_PREFIX}${userId}`
}

export async function savePasskeyUnlockRecord(record: PasskeyUnlockRecord): Promise<void> {
  const payload = { ...record, updatedAt: new Date().toISOString() }
  localStorage.setItem(storageKey(record.userId), JSON.stringify(payload))
}

export function loadPasskeyUnlockRecord(userId: string): PasskeyUnlockRecord | null {
  const raw = localStorage.getItem(storageKey(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as PasskeyUnlockRecord
  } catch {
    return null
  }
}

export function clearPasskeyUnlockRecord(userId: string): void {
  localStorage.removeItem(storageKey(userId))
}

export function hasPasskeyUnlockRecord(userId: string): boolean {
  return loadPasskeyUnlockRecord(userId) != null
}

/**
 * Wrap the wallet unlock password with the server-issued unlock key (only after WebAuthn proof).
 * Never persist unlockKey — only the encrypted password blob.
 */
export async function wrapUnlockPassword(
  userId: string,
  unlockPassword: string,
  unlockKey: string
): Promise<void> {
  const encryptedUnlockPassword = await encryptPrivateKey(unlockPassword, unlockKey)
  await savePasskeyUnlockRecord({ userId, encryptedUnlockPassword, updatedAt: new Date().toISOString() })
}

/**
 * Unwrap unlock password using unlock key from passkey auth verify response.
 */
export async function unwrapUnlockPassword(
  userId: string,
  unlockKey: string
): Promise<string> {
  const record = loadPasskeyUnlockRecord(userId)
  if (!record) throw new Error('Passkey unlock not configured on this device')
  return decryptPrivateKey(record.encryptedUnlockPassword, unlockKey)
}
