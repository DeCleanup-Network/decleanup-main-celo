import { buildContentSecurityPolicy, SECURITY_HEADERS } from './csp-headers.mjs'

const isDev = process.env.NODE_ENV !== 'production'

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // lucide-react omitted — optimizePackageImports can reference missing vendor-chunks in dev.
    optimizePackageImports: [
      'viem',
      'wagmi',
      '@rainbow-me/rainbowkit',
      'permissionless',
      '@tanstack/react-query',
    ],
  },
  // Serve .well-known directory correctly
  async headers() {
    return [
      {
        source: "/.well-known/:path*",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: "*",
          },
          {
            key: "Content-Type",
            value: "application/json",
          },
        ],
      },
      // Allow Google/Web3Auth popup to complete (fixes "Cross-Origin-Opener-Policy policy would block the window.closed call")
      {
        source: "/:path*",
        headers: [
          {
            key: "Cross-Origin-Opener-Policy",
            value: "same-origin-allow-popups",
          },
          ...SECURITY_HEADERS,
          {
            key: "Content-Security-Policy",
            value: buildContentSecurityPolicy(isDev),
          },
        ],
      },
    ];
  },
  // Webpack: resolve optional/React Native deps so layout and app chunks build (client + server)
  webpack: (config, { isServer, dev }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      // MetaMask SDK / Web3Auth (browser build doesn't need React Native async storage)
      '@react-native-async-storage/async-storage': false,
      // Fix Privy build error: dangling Farcaster dependencies
      '@farcaster/mini-app-solana': false,
      '@farcaster/mini-app-sdk': false,
    };
    // Optional pino dev dependency used by WalletConnect; avoid "Module not found" on server
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
      '@farcaster/mini-app-solana': false,
      '@farcaster/mini-app-sdk': false,
    };
    // Disable persistent cache in dev to avoid 500s from stale vendor-chunks (ERR_ABORTED on layout.css, app/page.js, etc.)
    if (dev) {
      // Default OFF: stale vendor-chunks (e.g. lucide-react.js) cause 500s after turbo/webpack switches.
      // Opt in: NEXT_DEV_ENABLE_WEBPACK_CACHE=1 or `npm run dev:fast`
      if (process.env.NEXT_DEV_ENABLE_WEBPACK_CACHE !== '1') {
        config.cache = false
      }
      // File polling is slow; use `npm run dev:poll` only if native watchers fail (EMFILE on macOS).
      if (process.env.WATCHPACK_POLLING === 'true') {
        config.watchOptions = {
          poll: 1000,
          aggregateTimeout: 300,
        }
      }
      if (process.env.NEXT_WEBPACK_SAFE_DEVTOOL === '1') {
        config.devtool = 'cheap-module-source-map'
      }
    }
    return config;
  },
};

export default nextConfig;

