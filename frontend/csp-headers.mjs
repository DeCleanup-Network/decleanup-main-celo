/**
 * CSP + security headers for next.config.mjs (plain ESM — Node must not import .ts here).
 * @see https://nextjs.org/docs/app/building-your-application/configuring/content-security-policy
 */

const PIMLICO = 'https://api.pimlico.io'
const GOOGLE_AUTH = 'https://accounts.google.com https://oauth2.googleapis.com'

/**
 * Injected wallet extensions (e.g. MetaMask inpage.js) may call Merkle RPC even when the
 * dApp uses Celo — without this, connect-src blocks spam the console but do not break the app.
 */
const WALLET_EXTENSION_RPC = 'https://eth.merkle.io https://*.merkle.io'

/** WalletConnect verify iframe (attestation modal). */
const WALLETCONNECT_FRAMES = [
  'https://verify.walletconnect.org',
  'https://verify.walletconnect.com',
  'https://secure.walletconnect.org',
  'https://secure.walletconnect.com',
].join(' ')

/** WalletConnect / Reown AppKit + relay (required when RainbowKit or WC is on the page). */
const WALLETCONNECT_CONNECT = [
  'https://pulse.walletconnect.org',
  'https://api.web3modal.org',
  'https://explorer-api.walletconnect.com',
  'https://verify.walletconnect.com',
  'https://registry.walletconnect.com',
  'https://relay.walletconnect.org',
  'https://relay.walletconnect.com',
  'https://*.walletconnect.org',
  'https://*.walletconnect.com',
  'wss://relay.walletconnect.org',
  'wss://relay.walletconnect.com',
  'wss://*.walletconnect.org',
  'wss://*.walletconnect.com',
  'https://api.reown.com',
  'https://*.reown.com',
].join(' ')

/** Ethereum mainnet RPC for ENS / optional client reads (server API preferred for ENS). */
function ethereumConnectOrigins() {
  const origins = new Set(['https://ethereum.publicnode.com'])
  for (const key of ['ETHEREUM_RPC_URL', 'NEXT_PUBLIC_ETHEREUM_RPC_URL']) {
    const rpc = process.env[key]?.trim()
    if (!rpc) continue
    try {
      origins.add(new URL(rpc).origin)
    } catch {
      // ignore invalid URL
    }
  }
  return [...origins].join(' ')
}

function rpcConnectOrigins() {
  const origins = new Set()
  const rpc = process.env.NEXT_PUBLIC_RPC_URL?.trim()
  if (rpc) {
    try {
      origins.add(new URL(rpc).origin)
    } catch {
      // ignore invalid URL
    }
  }
  origins.add('https://forno.celo.org')
  origins.add('https://forno.celo-sepolia.celo-testnet.org')
  return [...origins].join(' ')
}

export function buildContentSecurityPolicy(isDev) {
  const connectSrc = [
    "'self'",
    PIMLICO,
    GOOGLE_AUTH,
    WALLET_EXTENSION_RPC,
    WALLETCONNECT_CONNECT,
    rpcConnectOrigins(),
    ethereumConnectOrigins(),
    'https://*.celo-testnet.org',
    'wss:',
    ...(isDev ? ['ws://localhost:*', 'http://localhost:*'] : []),
  ].join(' ')

  const directives = [
    "default-src 'self'",
    isDev
      ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
      : "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data: https://fonts.gstatic.com",
    `connect-src ${connectSrc}`,
    `frame-src 'self' ${WALLETCONNECT_FRAMES} ${GOOGLE_AUTH}`,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "worker-src 'self' blob:",
    ...(isDev ? [] : ['upgrade-insecure-requests']),
  ]

  return directives.join('; ')
}

export const SECURITY_HEADERS = [
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(self), payment=()',
  },
  { key: 'X-XSS-Protection', value: '0' },
]

/** Production-only HSTS (skipped in local dev over HTTP). */
export function getSecurityHeaders(isDev) {
  if (isDev) return SECURITY_HEADERS
  return [
    ...SECURITY_HEADERS,
    {
      key: 'Strict-Transport-Security',
      value: 'max-age=31536000; includeSubDomains',
    },
  ]
}
