/**
 * Probes Web3Auth signer feature-access (same request the SDK makes during init).
 * 403 usually means Wallet Services is not enabled for this Client ID on Sapphire Mainnet.
 */

export type Web3AuthSapphireNetwork = 'sapphire_mainnet' | 'sapphire_devnet'

export type Web3AuthFeatureAccessResult = 'ok' | 'forbidden' | 'error'

export function buildWeb3AuthFeatureAccessUrl(
  clientId: string,
  network: Web3AuthSapphireNetwork
): string {
  const params = new URLSearchParams({
    client_id: clientId,
    network,
    is_wallet_service: 'true',
    enable_gating: 'true',
  })
  return `https://api.web3auth.io/signer-service/api/feature-access?${params.toString()}`
}

export async function checkWeb3AuthWalletServicesAccess(params: {
  clientId: string
  network: Web3AuthSapphireNetwork
}): Promise<Web3AuthFeatureAccessResult> {
  const { clientId, network } = params
  if (!clientId.trim()) return 'error'

  try {
    const res = await fetch(buildWeb3AuthFeatureAccessUrl(clientId, network), {
      method: 'GET',
      credentials: 'omit',
      cache: 'no-store',
    })
    if (res.status === 403) return 'forbidden'
    if (res.ok) return 'ok'
    return 'error'
  } catch {
    return 'error'
  }
}
