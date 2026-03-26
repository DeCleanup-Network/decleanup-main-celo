/** Hostnames allowed for /api/ipfs/fetch (open gateways only). */
export const IPFS_FETCH_ALLOWED_HOSTS = [
  'gateway.pinata.cloud',
  'ipfs.io',
  'www.ipfs.io',
  'cloudflare-ipfs.com',
  'dweb.link',
  'gateway.ipfs.io',
  'w3s.link',
] as const

export function isAllowedIpfsFetchHost(hostname: string): boolean {
  return (IPFS_FETCH_ALLOWED_HOSTS as readonly string[]).includes(hostname)
}
