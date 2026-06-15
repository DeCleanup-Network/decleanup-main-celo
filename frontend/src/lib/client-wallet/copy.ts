/**
 * User-facing wallet terminology.
 * "Wallet passcode" = 6-digit PIN the user chooses (not Google, not device lock screen).
 * "Biometric unlock" = Face ID / Touch ID / Windows Hello (WebAuthn).
 */

export const WALLET_PASSCODE = 'Wallet passcode'
export const WALLET_PASSCODE_LOWER = 'wallet passcode'
export const WALLET_PASSCODE_POSSESSIVE = 'your wallet passcode'

/** @deprecated Use WALLET_PASSCODE — kept for gradual migration */
export const WALLET_PASSKEY = WALLET_PASSCODE
/** @deprecated Use WALLET_PASSCODE_LOWER */
export const WALLET_PASSKEY_LOWER = WALLET_PASSCODE_LOWER
/** @deprecated Use WALLET_PASSCODE_POSSESSIVE */
export const WALLET_PASSKEY_POSSESSIVE = WALLET_PASSCODE_POSSESSIVE

export const BIOMETRIC_UNLOCK = 'Biometric unlock'
export const BIOMETRIC_UNLOCK_LOWER = 'biometric unlock'
export const BIOMETRIC_FACE_ID = 'Face ID / Touch ID'
