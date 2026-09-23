import {
  GOOGLEBOT_IPV4_CIDRS,
  GOOGLEBOT_IPV6_CIDRS,
} from '@/lib/server/googlebot-cidrs.generated'

/**
 * Google crawler User-Agent tokens.
 * User-Agent is not identity — always pair with {@link classifyGoogleCrawler}.
 * @see https://developers.google.com/search/docs/crawling-indexing/overview-google-crawlers
 */
const GOOGLE_CRAWLER_UA =
  /(?:^|[^a-z])(?:googlebot|google-inspectiontool|storebot-google|googleother|apis-google|adsbot-google|mediapartners-google|feedfetcher-google|google-safety)(?:[^a-z]|$)/i

const SCANNER_PATH =
  /^\/(?:\.env(?:\..+)?|\.git(?:\/.*)?|\.svn(?:\/.*)?|\.hg(?:\/.*)?|\.ds_store|\.htaccess|\.htpasswd|\.aws(?:\/.*)?|wp-admin(?:\/.*)?|wp-login\.php|wp-config\.php|xmlrpc\.php|phpmyadmin(?:\/.*)?|pma(?:\/.*)?|phpinfo\.php|vendor\/phpunit(?:\/.*)?|actuator(?:\/.*)?|server-status|cgi-bin(?:\/.*)?|backup\.sql|dump\.sql|config\.php)\/?$/i

const SENSITIVE_API_PREFIXES = [
  '/api/passkey',
  '/api/aa',
  '/api/auth',
  '/api/ipfs',
  '/api/ml-verification',
  '/api/hypercerts',
  '/api/verifier',
  '/api/trash-athlete',
  '/api/sponsor',
  '/api/uploads',
  '/api/cdcu',
  '/api/airdrop',
  '/api/contributors',
  '/api/telegram',
  '/api/rpc',
  '/api/cron',
] as const

export type GoogleCrawlerClass = 'none' | 'verified' | 'spoofed'

export function claimsGoogleCrawler(userAgent: string | null | undefined): boolean {
  if (!userAgent) return false
  return GOOGLE_CRAWLER_UA.test(userAgent)
}

export function normalizePathname(pathname: string): string {
  let path = pathname || '/'
  try {
    path = decodeURIComponent(path)
  } catch {
    // keep raw path if it is not valid URI encoding
  }
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1)
  return path
}

export function isScannerProbePath(pathname: string): boolean {
  return SCANNER_PATH.test(normalizePathname(pathname))
}

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase()
  return m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS'
}

export function isSensitiveApiPath(pathname: string): boolean {
  const path = normalizePathname(pathname)
  return SENSITIVE_API_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
}

/** Block spoofed crawlers on writes and authenticated APIs. Public GET pages stay open for SEO. */
export function shouldBlockSpoofedGooglebot(pathname: string, method: string): boolean {
  return isMutatingMethod(method) || isSensitiveApiPath(pathname)
}

export function ipv4ToInt(ip: string): number | null {
  const parts = ip.split('.')
  if (parts.length !== 4) return null
  let n = 0
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const value = Number(part)
    if (value > 255) return null
    n = (n << 8) + value
  }
  return n >>> 0
}

export function ipv4InCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/')
  const bits = Number(bitsRaw)
  const ipn = ipv4ToInt(ip)
  const basen = ipv4ToInt(base || '')
  if (ipn == null || basen == null || !Number.isInteger(bits) || bits < 0 || bits > 32) return false
  if (bits === 0) return true
  const mask = bits === 32 ? 0xffffffff : (~((1 << (32 - bits)) - 1)) >>> 0
  return (ipn & mask) === (basen & mask)
}

function hextetsToBigInt(hextets: string[]): bigint | null {
  if (hextets.length !== 8) return null
  let n = 0n
  for (const hex of hextets) {
    if (!/^[0-9a-fA-F]{1,4}$/.test(hex)) return null
    n = (n << 16n) + BigInt(parseInt(hex, 16))
  }
  return n
}

export function expandIpv6(ip: string): bigint | null {
  if (ip.includes('.')) return null
  const compressed = ip.split('::')
  if (compressed.length > 2) return null
  if (compressed.length === 1) {
    return hextetsToBigInt(ip.split(':'))
  }
  const left = compressed[0] ? compressed[0].split(':') : []
  const right = compressed[1] ? compressed[1].split(':') : []
  const missing = 8 - left.length - right.length
  if (missing < 0) return null
  return hextetsToBigInt([...left, ...Array(missing).fill('0'), ...right])
}

export function ipv6InCidr(ip: string, cidr: string): boolean {
  const [base, bitsRaw] = cidr.split('/')
  const bits = Number(bitsRaw)
  const ipn = expandIpv6(ip)
  const basen = expandIpv6(base || '')
  if (ipn == null || basen == null || !Number.isInteger(bits) || bits < 0 || bits > 128) return false
  if (bits === 0) return true
  const shift = BigInt(128 - bits)
  return ipn >> shift === basen >> shift
}

export function stripIpPort(ip: string): string {
  const trimmed = ip.trim()
  if (trimmed.startsWith('[')) {
    const end = trimmed.indexOf(']')
    if (end > 0) return trimmed.slice(1, end)
  }
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(trimmed)) {
    return trimmed.slice(0, trimmed.lastIndexOf(':'))
  }
  return trimmed
}

export function isPublishedGoogleCrawlerIp(ip: string | null | undefined): boolean {
  if (!ip || ip === 'unknown') return false
  const clean = stripIpPort(ip)
  if (clean.includes(':')) {
    return GOOGLEBOT_IPV6_CIDRS.some((cidr) => ipv6InCidr(clean, cidr))
  }
  return GOOGLEBOT_IPV4_CIDRS.some((cidr) => ipv4InCidr(clean, cidr))
}

export function classifyGoogleCrawler(
  userAgent: string | null | undefined,
  ip: string | null | undefined
): GoogleCrawlerClass {
  if (!claimsGoogleCrawler(userAgent)) return 'none'
  return isPublishedGoogleCrawlerIp(ip) ? 'verified' : 'spoofed'
}
