import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

export type EncryptedPayload = {
  ciphertext: string
  iv: string
  authTag: string
}

function getEncryptionKey(): Buffer {
  const raw = process.env.WALLET_ENCRYPTION_KEY?.trim()
  if (!raw) {
    throw new Error('WALLET_ENCRYPTION_KEY is not set (64 hex chars = 32 bytes).')
  }
  const hex = raw.startsWith('0x') ? raw.slice(2) : raw
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error('WALLET_ENCRYPTION_KEY must be 32 bytes encoded as 64 hex characters.')
  }
  return Buffer.from(hex, 'hex')
}

/** Encrypt UTF-8 plaintext (e.g. hex private key). Server-only. */
export function encryptSecret(plaintext: string): EncryptedPayload {
  const key = getEncryptionKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()
  return {
    ciphertext: encrypted.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
  }
}

/** Decrypt to UTF-8 string. Server-only — never send result to the client. */
export function decryptSecret(payload: EncryptedPayload): string {
  const key = getEncryptionKey()
  const iv = Buffer.from(payload.iv, 'base64')
  const authTag = Buffer.from(payload.authTag, 'base64')
  const ciphertext = Buffer.from(payload.ciphertext, 'base64')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8')
}
