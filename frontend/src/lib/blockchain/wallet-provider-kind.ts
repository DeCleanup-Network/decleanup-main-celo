import type { Connector } from 'wagmi'

/**
 * MetaMask / WalletConnect / browser-extension wallets usually expose vendor flags on the EIP-1193 provider.
 * Web3Auth embedded (social / email) MPC wallet typically does not — use paymaster for that path.
 *
 * If detection fails, default to **external** (user pays) so we do not burn sponsorship budget.
 */
export async function connectorLooksLikeExternalOwnedWallet(connector: Connector): Promise<boolean> {
  try {
    const gp = connector.getProvider?.bind(connector)
    if (!gp) return true
    const raw = await gp()
    const p = raw as Record<string, unknown> | null | undefined
    if (!p || typeof p !== 'object') return true
    if (p.isMetaMask === true) return true
    if (p.isCoinbaseWallet === true) return true
    if (p.isBraveWallet === true) return true
    if (p.isTrust === true) return true
    if (p.isWalletConnect === true) return true
    if (p.isRabby === true) return true
    return false
  } catch {
    return true
  }
}
