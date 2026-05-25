'use client'

import type { EncryptedWalletBlob } from '@/lib/client-wallet/types'
import { decryptPrivateKey, encryptPrivateKey } from '@/lib/client-wallet/encryption'

const SEAL_PREFIX = 'decleanup-device-seal:'

function sealStorageKey(userId: string): string {
  return `${SEAL_PREFIX}${userId}`
}

function randomSeal(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32))
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Per-device secret until the user sets a signing password. Never sent to the server. */
export function getOrCreateDeviceSeal(userId: string): string {
  const key = sealStorageKey(userId)
  const existing = localStorage.getItem(key)
  if (existing && existing.length >= 32) return existing
  const seal = randomSeal()
  localStorage.setItem(key, seal)
  return seal
}

export function clearDeviceSeal(userId: string): void {
  localStorage.removeItem(sealStorageKey(userId))
}

export async function encryptWithDeviceSeal(
  privateKeyHex: string,
  userId: string
): Promise<EncryptedWalletBlob> {
  return encryptPrivateKey(privateKeyHex, getOrCreateDeviceSeal(userId))
}

export async function decryptWithDeviceSeal(
  blob: EncryptedWalletBlob,
  userId: string
): Promise<string> {
  return decryptPrivateKey(blob, getOrCreateDeviceSeal(userId))
}
