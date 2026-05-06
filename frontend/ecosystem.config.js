/**
 * PM2 Ecosystem Configuration for DeCleanup Frontend
 * 
 * Usage:
 *   pm2 delete decleanup
 *   pm2 start ecosystem.config.js
 *   pm2 save
 */

const fs = require('fs')
const path = require('path')

// Load .env.local if it exists
function loadEnvLocal() {
  const envPath = path.join(__dirname, '.env.local')
  const env = {}
  
  if (fs.existsSync(envPath)) {
    const envFile = fs.readFileSync(envPath, 'utf8')
    envFile.split('\n').forEach(line => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=')
        if (key && valueParts.length > 0) {
          const value = valueParts.join('=').trim()
          // Remove quotes if present
          const cleanValue = value.replace(/^["']|["']$/g, '')
          env[key.trim()] = cleanValue
        }
      }
    })
  }
  
  return env
}

const envLocal = loadEnvLocal()

// Helper to get env var from .env.local or process.env
function getEnv(key, defaultValue = '') {
  const raw = envLocal[key] ?? process.env[key]
  if (raw == null || raw === '') return defaultValue
  const t = String(raw).trim()
  // Broken exports like UPLOAD_DIR= or KEY= with no path
  if (!t || /^[A-Z0-9_]+=$/.test(t)) return defaultValue
  return t
}

module.exports = {
  apps: [{
    name: 'decleanup',
    script: 'npm',
    args: 'start',
    cwd: '/var/www/decleanup/frontend',
    interpreter: 'none',
    
    // Environment variables
    // Reads from .env.local first, then process.env, then defaults
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
      
      // Blockchain Configuration
      NEXT_PUBLIC_CHAIN_ID: getEnv('NEXT_PUBLIC_CHAIN_ID', '11142220'),
      NEXT_PUBLIC_RPC_URL: getEnv('NEXT_PUBLIC_RPC_URL', 'https://forno.celo-sepolia.celo-testnet.org'),
      NEXT_PUBLIC_SEPOLIA_RPC_URL: getEnv('NEXT_PUBLIC_SEPOLIA_RPC_URL', 'https://forno.celo-sepolia.celo-testnet.org'),
      NEXT_PUBLIC_BLOCK_EXPLORER_URL: getEnv('NEXT_PUBLIC_BLOCK_EXPLORER_URL', 'https://celo-sepolia.blockscout.com'),
      
      // Contract Addresses (set these in .env.local)
      NEXT_PUBLIC_SUBMISSION_CONTRACT: getEnv('NEXT_PUBLIC_SUBMISSION_CONTRACT', ''),
      NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT: getEnv('NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT', ''),
      NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT: getEnv('NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT', ''),
      
      // IPFS Configuration
      NEXT_PUBLIC_IPFS_GATEWAY: getEnv('NEXT_PUBLIC_IPFS_GATEWAY', 'https://gateway.pinata.cloud/ipfs/'),
      NEXT_PUBLIC_IMPACT_IMAGES_CID: getEnv('NEXT_PUBLIC_IMPACT_IMAGES_CID', 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'),
      
      // App Configuration
      NEXT_PUBLIC_MINIAPP_URL: getEnv('NEXT_PUBLIC_MINIAPP_URL', 'http://207.180.203.243:3000'),
      NEXT_PUBLIC_SITE_URL: getEnv('NEXT_PUBLIC_SITE_URL', 'http://207.180.203.243:3000'),
      NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID: getEnv('NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID', '3a8170812b534d0ff9d794f19a901d64'),
      
      // ML Verification / GPU Service
      ML_VERIFICATION_ENABLED: getEnv('ML_VERIFICATION_ENABLED', 'true'),
      GPU_INFERENCE_SERVICE_URL: getEnv('GPU_INFERENCE_SERVICE_URL', 'http://127.0.0.1:8000'),
      GPU_SHARED_SECRET: getEnv('GPU_SHARED_SECRET', ''),
      // Same value as Vercel; required on ml host when locking ingress. Do NOT set ML_BACKEND_ORIGIN here.
      ML_PROXY_SHARED_SECRET: getEnv('ML_PROXY_SHARED_SECRET', ''),
      
      // File Upload Configuration
      UPLOAD_DIR: getEnv('UPLOAD_DIR', '/var/www/decleanup/uploads'),
      PUBLIC_URL_BASE: getEnv('PUBLIC_URL_BASE', 'http://207.180.203.243:3000'),
      
      // Pinata (for IPFS uploads) — PINATA_JWT preferred per Pinata pinFileToIPFS docs
      PINATA_JWT: getEnv('PINATA_JWT', ''),
      PINATA_API_KEY: getEnv('PINATA_API_KEY', ''),
      PINATA_SECRET_KEY: getEnv('PINATA_SECRET_KEY', ''),
      PINATA_SECRET_API_KEY: getEnv('PINATA_SECRET_API_KEY', ''),
    },
    
    // Process management
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    autorestart: true,
    max_memory_restart: '1G',
    
    // Logging
    error_file: '/var/www/decleanup/logs/pm2-error.log',
    out_file: '/var/www/decleanup/logs/pm2-out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    
    // Advanced
    min_uptime: '10s',
    max_restarts: 10,
    restart_delay: 4000,
  }]
}
