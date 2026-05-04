/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    optimizePackageImports: ['viem', 'wagmi', '@rainbow-me/rainbowkit'],
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
    };
    // Optional pino dev dependency used by WalletConnect; avoid "Module not found" on server
    config.resolve.fallback = {
      ...config.resolve.fallback,
      'pino-pretty': false,
    };
    // Disable persistent cache in dev to avoid 500s from stale vendor-chunks (ERR_ABORTED on layout.css, app/page.js, etc.)
    if (dev) {
      config.cache = false;
      // Default webpack devtool wraps each module in eval(). SES lockdown (some wallet/MetaMask-related
      // extensions) rejects that and the browser reports: Uncaught SyntaxError: Invalid or unexpected token
      // at layout.js (eval line). Use a non-eval devtool so local dev works with those extensions.
      config.devtool = "cheap-module-source-map";
    }
    return config;
  },
};

export default nextConfig;

