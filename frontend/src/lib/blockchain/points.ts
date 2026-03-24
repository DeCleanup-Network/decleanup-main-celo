// frontend/src/lib/blockchain/points.ts
// -------------------------------------------------------------
// Frontend Simulated Points Storage (LocalStorage based)
// Used only when onchain reward distributor contract is missing.
// -------------------------------------------------------------

export type PointsStorage = Record<string, string> // address -> bigint string (wei style)

const LS_KEY = 'decleanup_points_v1'
const toBigIntStr = (n: bigint) => n.toString()

function readStore(): PointsStorage {
  if (typeof window === 'undefined') return {}
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw)
  } catch {
    return {}
  }
}

function writeStore(s: PointsStorage) {
  if (typeof window === 'undefined') return
  localStorage.setItem(LS_KEY, JSON.stringify(s))
}

// Add points (use wei-style bigint)
export function addPoints(address: string, amount: bigint) {
  const store = readStore()
  const prev = BigInt(store[address] || '0')
  store[address] = toBigIntStr(prev + amount)
  writeStore(store)
}

// Get points (returns bigint)
export function getPoints(address: string): bigint {
  const store = readStore()
  return BigInt(store[address] || '0')
}

// Force set (for testing)
export function setPoints(address: string, amount: bigint) {
  const store = readStore()
  store[address] = toBigIntStr(amount)
  writeStore(store)
}

// Remove a user's points
export function resetPoints(address: string) {
  const store = readStore()
  delete store[address]
  writeStore(store)
}
