import type { Address, Hex } from 'viem'
import { getAddress, verifyMessage } from 'viem'

export type WalletSignFields = {
  domain: string
  uri: string
  address: Address
  chainId: number
  nonce: string
}

export function buildWalletSignMessage(fields: WalletSignFields): string {
  const address = getAddress(fields.address)
  return [
    `${fields.domain} wants you to sign in with your Ethereum account:`,
    address,
    '',
    'Sign in to DeCleanup. This request will not trigger a blockchain transaction or cost gas.',
    '',
    `URI: ${fields.uri}`,
    'Version: 1',
    `Chain ID: ${fields.chainId}`,
    `Nonce: ${fields.nonce}`,
    `Issued At: ${new Date().toISOString()}`,
  ].join('\n')
}

/** Parse fields from the message the client signed (must match buildWalletSignMessage). */
export function parseWalletSignMessage(message: string): WalletSignFields | null {
  const lines = message.split('\n')
  const domainLine = lines[0]
  if (!domainLine?.includes(' wants you to sign in')) return null
  const domain = domainLine.split(' wants you to sign in')[0]?.trim()
  const address = lines[1]?.trim()
  if (!domain || !address) return null

  let uri = ''
  let chainId = 0
  let nonce = ''
  for (const line of lines) {
    if (line.startsWith('URI: ')) uri = line.slice('URI: '.length)
    if (line.startsWith('Chain ID: ')) chainId = Number(line.slice('Chain ID: '.length))
    if (line.startsWith('Nonce: ')) nonce = line.slice('Nonce: '.length)
  }
  if (!uri || !chainId || !nonce) return null

  try {
    return { domain, uri, address: getAddress(address), chainId, nonce }
  } catch {
    return null
  }
}

export async function verifyWalletSignMessage(
  message: string,
  signature: Hex
): Promise<WalletSignFields | null> {
  const fields = parseWalletSignMessage(message)
  if (!fields) return null
  const valid = await verifyMessage({
    address: fields.address,
    message,
    signature,
  })
  return valid ? fields : null
}
