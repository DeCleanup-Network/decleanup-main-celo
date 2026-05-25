'use client'

export function getClientWebAuthnRpId(): string {
  if (typeof window === 'undefined') return 'localhost'
  if (process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID?.trim()) {
    return process.env.NEXT_PUBLIC_WEBAUTHN_RP_ID.trim()
  }
  return window.location.hostname
}

export function isPasskeySupported(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.isSecureContext &&
    typeof window.PublicKeyCredential !== 'undefined' &&
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function'
  )
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isPasskeySupported()) return false
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
  } catch {
    return false
  }
}
