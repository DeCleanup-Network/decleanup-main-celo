/** Six-digit wallet passcode (phone-style PIN) for new wallet setup. */
export const WALLET_PASSCODE_LENGTH = 6

const PASSCODE_PATTERN = /^\d{6}$/

export function isValidWalletPasscode(value: string): boolean {
  return PASSCODE_PATTERN.test(value)
}

export function normalizeWalletPasscodeInput(value: string): string {
  return value.replace(/\D/g, '').slice(0, WALLET_PASSCODE_LENGTH)
}
