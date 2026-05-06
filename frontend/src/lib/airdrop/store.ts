import path from 'path'

type AirdropStore = Record<string, string>

const DEFAULT_AIRDROP_STORE_PATH = path.join(process.cwd(), 'data', 'airdrop-issued.json')

function getStorePath() {
  return process.env.AIRDROP_ISSUED_STORE_PATH || DEFAULT_AIRDROP_STORE_PATH
}

export function loadAirdropStore(): AirdropStore {
  const fs = require('fs')
  const filePath = getStorePath()
  try {
    if (!fs.existsSync(filePath)) return {}
    const raw = fs.readFileSync(filePath, 'utf-8')
    return JSON.parse(raw) as AirdropStore
  } catch {
    return {}
  }
}

export function saveAirdropStore(store: AirdropStore): void {
  const fs = require('fs')
  const filePath = getStorePath()
  const dirPath = path.dirname(filePath)
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(store, null, 2))
}

function claimedKey(recipient: string) {
  return `claimed_${recipient.toLowerCase()}`
}

function pendingKey(recipient: string) {
  return `pending_${recipient.toLowerCase()}`
}

export function hasAirdropClaimed(store: AirdropStore, recipient: string): boolean {
  return store[claimedKey(recipient)] === '1'
}

export function getAirdropPending(store: AirdropStore, recipient: string): bigint {
  return BigInt(store[pendingKey(recipient)] ?? '0')
}

export function setAirdropPending(store: AirdropStore, recipient: string, amountWei: bigint): void {
  const key = pendingKey(recipient)
  if (amountWei === 0n) delete store[key]
  else store[key] = amountWei.toString()
}

export function markAirdropClaimed(store: AirdropStore, recipient: string): void {
  store[claimedKey(recipient)] = '1'
  setAirdropPending(store, recipient, 0n)
}
