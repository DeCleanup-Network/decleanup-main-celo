/**
 * Client-encrypted wallet blob. Server stores this JSON as opaque data — never decrypts.
 */
export type EncryptedWalletBlob = {
  version: 1
  /** AES-GCM ciphertext (base64) */
  encryptedData: string
  iv: string
  /** PBKDF2 salt (base64) */
  salt: string
}

export type LocalWalletRecord = {
  userId: string
  address: `0x${string}`
  smartAccountAddress: `0x${string}`
  encryptedBlob: EncryptedWalletBlob
  chainId: number
  updatedAt: string
  /** Wallet exists but user has not set a signing password yet (device-sealed blob). */
  pendingSigningPassword?: boolean
}
