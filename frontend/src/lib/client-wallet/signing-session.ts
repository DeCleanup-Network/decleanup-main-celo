'use client'

import type { Address, Hex } from 'viem'
import { parseEther } from 'viem'

/** How long the in-memory delegated signer stays active after unlock. */
export type SessionDurationId = '15m' | '1h' | '4h' | '24h' | '7d' | 'until-lock'

/** Default for new users and when "stay unlocked" is off. */
export const DEFAULT_SESSION_DURATION_ID: SessionDurationId = '4h'

/** Stored in localStorage when user enables "stay unlocked longer on this device". */
export const STAY_UNLOCKED_ON_DEVICE_DURATION_ID: SessionDurationId = '7d'

export const SESSION_DURATION_OPTIONS: Array<{
  id: SessionDurationId
  label: string
  ms: number | null
}> = [
  { id: '15m', label: '15 minutes', ms: 15 * 60 * 1000 },
  { id: '1h', label: '1 hour', ms: 60 * 60 * 1000 },
  { id: '4h', label: '4 hours (recommended)', ms: 4 * 60 * 60 * 1000 },
  { id: '24h', label: '24 hours', ms: 24 * 60 * 60 * 1000 },
  { id: '7d', label: '7 days', ms: 7 * 24 * 60 * 60 * 1000 },
  { id: 'until-lock', label: 'Until I lock (this tab)', ms: null },
]

const DURATION_STORAGE_KEY = 'decleanup-signing-session-duration'

/** No auto-expiry; user must tap Lock or close the tab (key cleared on refresh). */
export const SESSION_NO_AUTO_EXPIRY = Number.MAX_SAFE_INTEGER

/** Limits for the temporary delegated signer (in-memory only, never persisted). */
export type SigningSessionPolicy = {
  /** Max native token value per single UserOperation (wei). */
  maxValuePerTxWei: bigint
  /** When true, only plain transfers (empty calldata) are allowed. */
  transfersOnly: boolean
}

export const DEFAULT_SESSION_POLICY: SigningSessionPolicy = {
  maxValuePerTxWei: parseEther('10'),
  transfersOnly: true,
}

export type ActiveSigningSession = {
  expiresAt: number
  policy: SigningSessionPolicy
  durationId: SessionDurationId
}

export function isSessionWithoutAutoExpiry(durationId: SessionDurationId): boolean {
  return durationId === 'until-lock'
}

export function getSessionDurationMs(id: SessionDurationId): number {
  if (isSessionWithoutAutoExpiry(id)) return SESSION_NO_AUTO_EXPIRY
  return SESSION_DURATION_OPTIONS.find((o) => o.id === id)?.ms ?? 4 * 60 * 60 * 1000
}

export function getPreferredSessionDuration(): SessionDurationId {
  if (typeof window === 'undefined') return DEFAULT_SESSION_DURATION_ID
  const raw = localStorage.getItem(DURATION_STORAGE_KEY)
  const valid = SESSION_DURATION_OPTIONS.map((o) => o.id)
  if (raw && valid.includes(raw as SessionDurationId)) return raw as SessionDurationId
  return DEFAULT_SESSION_DURATION_ID
}

export function setPreferredSessionDuration(id: SessionDurationId): void {
  localStorage.setItem(DURATION_STORAGE_KEY, id)
}

export function isStayUnlockedOnDevicePreference(): boolean {
  const id = getPreferredSessionDuration()
  return id === STAY_UNLOCKED_ON_DEVICE_DURATION_ID || id === 'until-lock'
}

export function setStayUnlockedOnDevice(enabled: boolean): void {
  setPreferredSessionDuration(
    enabled ? STAY_UNLOCKED_ON_DEVICE_DURATION_ID : DEFAULT_SESSION_DURATION_ID
  )
}

export function createSigningSession(durationId: SessionDurationId): ActiveSigningSession {
  return {
    expiresAt: isSessionWithoutAutoExpiry(durationId)
      ? SESSION_NO_AUTO_EXPIRY
      : Date.now() + getSessionDurationMs(durationId),
    policy: DEFAULT_SESSION_POLICY,
    durationId,
  }
}

export function isSigningSessionActive(session: ActiveSigningSession | null): boolean {
  if (session == null) return false
  if (isSessionWithoutAutoExpiry(session.durationId)) return true
  return session.expiresAt > Date.now()
}

/** Reset expiry to the full chosen duration (used on activity). */
export function refreshSigningSessionExpiry(session: ActiveSigningSession): ActiveSigningSession {
  if (isSessionWithoutAutoExpiry(session.durationId)) return session
  return {
    ...session,
    expiresAt: Date.now() + getSessionDurationMs(session.durationId),
  }
}

export function formatSessionExpiry(expiresAt: number): string {
  if (expiresAt >= SESSION_NO_AUTO_EXPIRY - 86400000) return 'Until you lock'
  return new Date(expiresAt).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })
}

export function formatSessionRemaining(expiresAt: number, durationId?: SessionDurationId): string {
  if (durationId && isSessionWithoutAutoExpiry(durationId)) return 'Until lock'
  if (expiresAt >= SESSION_NO_AUTO_EXPIRY - 86400000) return 'Until lock'
  const ms = Math.max(0, expiresAt - Date.now())
  const mins = Math.ceil(ms / 60_000)
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    const h = hours % 24
    return h > 0 ? `${days}d ${h}h` : `${days}d`
  }
  return rem > 0 ? `${hours}h ${rem}m` : `${hours}h`
}

/** Live countdown for session UI (mm:ss), or until-lock state. */
export function getSessionCountdown(
  expiresAt: number,
  durationId?: SessionDurationId
): {
  label: string
  totalMs: number
  isExpired: boolean
  isUrgent: boolean
  untilLock: boolean
} {
  if (durationId && isSessionWithoutAutoExpiry(durationId)) {
    return { label: 'Until lock', totalMs: Infinity, isExpired: false, isUrgent: false, untilLock: true }
  }
  if (expiresAt >= SESSION_NO_AUTO_EXPIRY - 86400000) {
    return { label: 'Until lock', totalMs: Infinity, isExpired: false, isUrgent: false, untilLock: true }
  }
  const totalMs = Math.max(0, expiresAt - Date.now())
  const isExpired = totalMs <= 0
  const isUrgent = totalMs > 0 && totalMs < 5 * 60 * 1000
  const totalSec = Math.floor(totalMs / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  const label =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return { label, totalMs, isExpired, isUrgent, untilLock: false }
}

/**
 * Enforce delegated-signer policy before signing a UserOperation.
 * The owner key stays in memory; this gates what it may sign during the session.
 */
export function assertSessionCanSign(
  session: ActiveSigningSession | null,
  params: { to: Address; value?: bigint; data?: Hex }
): void {
  if (!session || !isSigningSessionActive(session)) {
    throw new Error('Signing session expired. Unlock your wallet to continue.')
  }

  const value = params.value ?? 0n
  const data = params.data ?? '0x'
  const { policy } = session

  if (value > policy.maxValuePerTxWei) {
    throw new Error(
      `Transaction exceeds session limit (${policy.maxValuePerTxWei.toString()} wei max per tx). End session and unlock to sign larger amounts.`
    )
  }

  if (policy.transfersOnly && data !== '0x' && data.length > 2) {
    throw new Error(
      'This signing session only allows simple transfers. End session to sign contract calls.'
    )
  }
}
