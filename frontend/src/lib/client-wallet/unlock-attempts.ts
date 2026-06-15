const STORAGE_KEY = 'dcu_wallet_unlock_attempts'
const MAX_ATTEMPTS = 5
const LOCKOUT_MS = 60_000

type AttemptState = {
  count: number
  lockedUntil: number | null
}

function readState(): AttemptState {
  if (typeof window === 'undefined') return { count: 0, lockedUntil: null }
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY)
    if (!raw) return { count: 0, lockedUntil: null }
    const parsed = JSON.parse(raw) as AttemptState
    if (parsed.lockedUntil && Date.now() >= parsed.lockedUntil) {
      return { count: 0, lockedUntil: null }
    }
    return parsed
  } catch {
    return { count: 0, lockedUntil: null }
  }
}

function writeState(state: AttemptState): void {
  if (typeof window === 'undefined') return
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
}

export function getUnlockAttemptStatus(): {
  locked: boolean
  remaining: number
  lockoutSeconds: number
} {
  const state = readState()
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return {
      locked: true,
      remaining: 0,
      lockoutSeconds: Math.ceil((state.lockedUntil - Date.now()) / 1000),
    }
  }
  return {
    locked: false,
    remaining: Math.max(0, MAX_ATTEMPTS - state.count),
    lockoutSeconds: 0,
  }
}

export function recordFailedUnlockAttempt(): ReturnType<typeof getUnlockAttemptStatus> {
  const state = readState()
  if (state.lockedUntil && Date.now() < state.lockedUntil) {
    return getUnlockAttemptStatus()
  }
  const nextCount = state.count + 1
  if (nextCount >= MAX_ATTEMPTS) {
    writeState({ count: 0, lockedUntil: Date.now() + LOCKOUT_MS })
  } else {
    writeState({ count: nextCount, lockedUntil: null })
  }
  return getUnlockAttemptStatus()
}

export function clearUnlockAttempts(): void {
  if (typeof window === 'undefined') return
  sessionStorage.removeItem(STORAGE_KEY)
}
