/**
 * PM2 config for GPU inference (run on the VPS next to Next.js).
 *
 * Prereqs on server:
 *   cd /var/www/decleanup/gpu-inference-service
 *   python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
 *   Place best.pt (or set MODEL_PATH) in this directory.
 *
 * Set SHARED_SECRET to match frontend GPU_SHARED_SECRET, then:
 *   pm2 start ecosystem.config.cjs && pm2 save
 *
 * Frontend should use GPU_INFERENCE_SERVICE_URL=http://127.0.0.1:8000 when colocated.
 */
const fs = require('fs')
const path = require('path')

function loadEnvFile(name) {
  const envPath = path.join(__dirname, name)
  const env = {}
  if (!fs.existsSync(envPath)) return env
  fs.readFileSync(envPath, 'utf8')
    .split('\n')
    .forEach((line) => {
      const trimmed = line.trim()
      if (trimmed && !trimmed.startsWith('#')) {
        const i = trimmed.indexOf('=')
        if (i > 0) {
          const key = trimmed.slice(0, i).trim()
          let value = trimmed.slice(i + 1).trim()
          value = value.replace(/^["']|["']$/g, '')
          env[key] = value
        }
      }
    })
  return env
}

const fileEnv = loadEnvFile('.env.gpu')

module.exports = {
  apps: [
    {
      name: 'decleanup-gpu',
      cwd: __dirname,
      script: './.venv/bin/python',
      args: 'main.py',
      interpreter: 'none',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '4G',
      restart_delay: 3000,
      min_uptime: '10s',
      max_restarts: 10,
      env: {
        NODE_ENV: 'production',
        MODEL_PATH: fileEnv.MODEL_PATH || 'best.pt',
        MODEL_VERSION: fileEnv.MODEL_VERSION || 'sharktide-waste',
        PORT: fileEnv.PORT || '8000',
        HOST: fileEnv.HOST || '127.0.0.1',
        SHARED_SECRET: fileEnv.SHARED_SECRET || process.env.SHARED_SECRET || '',
      },
    },
  ],
}
