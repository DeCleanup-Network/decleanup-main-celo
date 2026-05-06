/**
 * Server-only: when not strictly `'true'`, ML verify/result skip GPU and proxy work.
 * Set `ML_VERIFICATION_ENABLED=false` on Vercel (and ml host if used) for mainnet soft-launch without GPU.
 */
export function isMlVerificationEnabled(): boolean {
  return process.env.ML_VERIFICATION_ENABLED === 'true'
}
