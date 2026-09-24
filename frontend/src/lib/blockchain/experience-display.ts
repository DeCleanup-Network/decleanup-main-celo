import { getActiveNativeGasSymbol, isSupportedChainId } from './aa-chain'
import { REQUIRED_CHAIN_ID, getChainConfig, type SupportedChainId } from './chain-constants'
import { isBaseExperience } from './chain-preference'

export function getExperienceDisplay(chainId: number = REQUIRED_CHAIN_ID) {
  const id: SupportedChainId = isSupportedChainId(chainId) ? chainId : REQUIRED_CHAIN_ID
  const config = getChainConfig(id)
  const base = isBaseExperience(id)
  const tokenAddress = config.contracts.DCU_TOKEN?.trim() || ''
  const explorer = config.blockExplorerUrl.replace(/\/$/, '')

  return {
    chainId: id,
    networkName: config.name,
    gasSymbol: getActiveNativeGasSymbol(id),
    tokenSymbol: base ? '$bDCU' : '$cDCU',
    tokenTicker: base ? 'bDCU' : 'cDCU',
    tokenAddress,
    explorerUrl: explorer,
    explorerName: explorer.replace(/^https?:\/\//, ''),
    rpcUrl: config.rpcUrl,
    addressExplorerHref: (addr: string) => `${explorer}/address/${addr}`,
    tokenExplorerHref: tokenAddress ? `${explorer}/token/${tokenAddress}` : null,
  }
}
