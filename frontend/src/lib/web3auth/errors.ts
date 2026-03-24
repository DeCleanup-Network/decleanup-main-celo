/**
 * Web3Auth WalletLoginError code for "Wallet popup has been closed by the user"
 * (@web3auth/no-modal base/errors — code 5114).
 */
export const WEB3AUTH_POPUP_CLOSED_CODE = 5114

function messageLooksLikePopupClosed(m: string): boolean {
  const s = m.toLowerCase()
  return s.includes('popup has been closed') || s.includes('window has been closed')
}

/**
 * Resolves Web3Auth popup-closed errors whether `reason` is the error, nested, or minified.
 */
export function isWeb3AuthPopupClosedError(reason: unknown): boolean {
  if (reason == null) return false
  const r = reason as Record<string, unknown>
  const code = r.code
  if (code === WEB3AUTH_POPUP_CLOSED_CODE || Number(code) === WEB3AUTH_POPUP_CLOSED_CODE) return true
  const msg = typeof r.message === 'string' ? r.message : ''
  if (msg && messageLooksLikePopupClosed(msg)) return true
  if (messageLooksLikePopupClosed(String(reason))) return true
  if (isWeb3AuthPopupClosedError(r.cause)) return true
  if (isWeb3AuthPopupClosedError(r.error)) return true
  try {
    const json = JSON.stringify(reason)
    if (json.includes('"code":5114') || json.includes('"code": 5114')) return true
  } catch {
    /* ignore */
  }
  return false
}
