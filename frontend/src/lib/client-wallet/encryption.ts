'use client'

import type { EncryptedWalletBlob } from '@/lib/client-wallet/types'

const PBKDF2_ITERATIONS = 310_000
const AES_GCM_IV_LENGTH = 12
const SALT_LENGTH = 16

function bufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!)
  return btoa(binary)
}

function base64ToBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

async function deriveKey(password: string, salt: ArrayBuffer): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ])
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/**
 * Encrypt a hex private key locally with the user's unlock password (WebCrypto AES-GCM + PBKDF2).
 */
export async function encryptPrivateKey(
  privateKeyHex: string,
  password: string
): Promise<EncryptedWalletBlob> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH))
  const iv = crypto.getRandomValues(new Uint8Array(AES_GCM_IV_LENGTH))
  const key = await deriveKey(password, salt.buffer)
  const enc = new TextEncoder()
  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(privateKeyHex)
  )
  return {
    version: 1,
    encryptedData: bufferToBase64(ciphertext),
    iv: bufferToBase64(iv.buffer),
    salt: bufferToBase64(salt.buffer),
  }
}

/**
 * Decrypt locally in the browser. Never call on the server.
 */
export async function decryptPrivateKey(
  blob: EncryptedWalletBlob,
  password: string
): Promise<string> {
  const key = await deriveKey(password, base64ToBuffer(blob.salt))
  const iv = new Uint8Array(base64ToBuffer(blob.iv))
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    base64ToBuffer(blob.encryptedData)
  )
  return new TextDecoder().decode(plaintext)
}
