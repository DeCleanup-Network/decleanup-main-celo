import { buildContentSecurityPolicy, getSecurityHeaders } from './csp-headers.mjs'

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
        source: "/manifest.webmanifest",
        headers: [
          { key: "Content-Type", value: "application/manifest+json" },
          { key: "Cache-Control", value: "public, max-age=86400" },
        ],
      },
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
          ...getSecurityHeaders(isDev),
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
      // Do not set config.devtool — Next.js 14 forces eval-source-map in dev and logs
      // https://nextjs.org/docs/messages/improper-devtool if you override it.
    }
    return config;
  },
};

export default nextConfig;

