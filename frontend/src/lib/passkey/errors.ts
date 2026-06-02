/** Map WebAuthn / passkey errors to short, actionable copy for users. */
export function formatWebAuthnError(err: unknown): string {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : 'Biometric unlock failed'
  const lower = message.toLowerCase()

  if (
    lower.includes('operation-specific reason') ||
    lower.includes('notallowederror') ||
    lower.includes('not allowed') ||
    lower.includes('cancelled') ||
    lower.includes('canceled') ||
    lower.includes('abort') ||
    lower.includes('user denied') ||
    lower.includes('request is not allowed')
  ) {
    return 'Face ID / Touch ID did not complete. Try again, use Safari or Chrome on this device, or unlock with your wallet passkey instead.'
  }

  if (
    lower.includes('securityerror') ||
    lower.includes('invalid domain') ||
    lower.includes('rp id') ||
    lower.includes('relying party') ||
    lower.includes('origin') ||
    lower.includes('mismatch')
  ) {
    return 'This site could not be verified for biometrics. Open the same URL you always use (for example https://dapp.decleanup.net) in Safari or Chrome, then try again.'
  }

  if (lower.includes('no passkeys registered') || lower.includes('passkey unlock not configured')) {
    return 'Face ID / Touch ID is not set up on this device yet. Enable it below with your wallet passkey, or unlock with your passkey.'
  }

  if (lower.includes('timeout') || lower.includes('timed out')) {
    return 'Biometrics timed out. Try again or use your wallet passkey.'
  }

  return message
}
