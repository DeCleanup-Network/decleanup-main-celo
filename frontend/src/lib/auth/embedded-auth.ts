/** Auth.js providers that use the embedded Safe smart account (not MetaMask-only). */
export type EmbeddedAuthProvider = 'google' | 'email'

export function isEmbeddedAuthProvider(
  provider: string | undefined | null
): provider is EmbeddedAuthProvider {
  return provider === 'google' || provider === 'email'
}
