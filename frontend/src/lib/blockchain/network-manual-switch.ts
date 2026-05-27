import {
  REQUIRED_BLOCK_EXPLORER_URL,
  REQUIRED_CHAIN_ID,
  REQUIRED_CHAIN_NAME,
  REQUIRED_RPC_URL,
} from '@/lib/blockchain/chain-constants'

export function manualSwitchInstructions(): string {
  return (
    `Please switch to ${REQUIRED_CHAIN_NAME} manually in your wallet:\n\n` +
    `1. Open your wallet's network dropdown\n` +
    `2. Add network or "Add a network manually" if needed\n` +
    `3. Use:\n` +
    `   - Network Name: ${REQUIRED_CHAIN_NAME}\n` +
    `   - RPC URL: ${REQUIRED_RPC_URL}\n` +
    `   - Chain ID: ${REQUIRED_CHAIN_ID}\n` +
    `   - Currency: CELO\n` +
    `   - Block Explorer: ${REQUIRED_BLOCK_EXPLORER_URL}\n` +
    `4. Save and switch to this network`
  )
}

export const MANUAL_SWITCH_INSTRUCTIONS = manualSwitchInstructions()
