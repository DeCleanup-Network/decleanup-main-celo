import type { Address } from 'viem'
import {
  REQUIRED_CHAIN_ID,
  getChainConfig,
  type SupportedChainId,
} from './chain-constants'
import { isSupportedChainId, resolveActiveChainId } from './aa-chain'
import { isBaseExperience } from './chain-preference'

/** Live experience chain (localStorage pick in the browser, env on the server). */
export function getActiveAppChainId(): SupportedChainId {
  const id = resolveActiveChainId()
  return isSupportedChainId(id) ? id : REQUIRED_CHAIN_ID
}

export function getActiveAppContracts() {
  return getChainConfig(getActiveAppChainId()).contracts
}

export function getActiveAppRpcUrl(): string {
  return getChainConfig(getActiveAppChainId()).rpcUrl
}

/** Live Base Submission is the Mini App proxy (`submitCleanup`), not Celo `createSubmission`. */
export function usesBaseMiniAppSubmission(chainId: number = getActiveAppChainId()): boolean {
  return isBaseExperience(chainId)
}

export function getSubmissionAddress(): Address | undefined {
  const addr = getActiveAppContracts().VERIFICATION?.trim()
  if (addr) return addr as Address
  return process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined
}

export function getRewardManagerAddress(): Address | undefined {
  const addr = getActiveAppContracts().REWARD_DISTRIBUTOR?.trim()
  if (addr) return addr as Address
  return process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT as Address | undefined
}

export function getImpactProductAddress(): Address | undefined {
  const addr = getActiveAppContracts().IMPACT_PRODUCT?.trim()
  return addr ? (addr as Address) : undefined
}

export function requireSubmissionAddress(): Address {
  const address = getSubmissionAddress()
  if (!address) {
    throw new Error(
      'Submission contract address not configured for the selected chain.'
    )
  }
  return address
}

export function requireRewardManagerAddress(): Address {
  const address = getRewardManagerAddress()
  if (!address) {
    throw new Error(
      'Reward manager address not configured for the selected chain.'
    )
  }
  return address
}
