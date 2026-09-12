'use client'

import {
  startAuthentication,
  startRegistration,
} from '@simplewebauthn/browser'
import type {
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser'
import { wrapUnlockPassword } from '@/lib/client-wallet/passkey-unlock'
import { formatWebAuthnError } from '@/lib/passkey/errors'

export async function fetchPasskeyStatus(): Promise<{
  hasPasskey: boolean
  count: number
  credentials: Array<{
    id: string
    credentialID: string
    deviceType: string | null
    createdAt: string
  }>
}> {
  const res = await fetch('/api/passkey/status', { credentials: 'include' })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to load passkey status')
  return data
}

function isPreviouslyRegisteredError(err: unknown): boolean {
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'string'
        ? err
        : ''
  const name = err instanceof Error ? err.name : ''
  const lower = `${name} ${message}`.toLowerCase()
  return (
    lower.includes('invalidstate') ||
    lower.includes('previously registered') ||
    lower.includes('already registered') ||
    lower.includes('credentialexclude')
  )
}

/** Prove an existing iCloud/Keychain passkey and re-wrap unlock for this install. */
export async function rebindPasskey(userId: string, unlockPassword: string): Promise<void> {
  const unlockKey = await authenticatePasskey()
  await wrapUnlockPassword(userId, unlockPassword, unlockKey)
}

async function registerNewPasskey(userId: string, unlockPassword: string): Promise<void> {
  const optionsRes = await fetch('/api/passkey/register/options', {
    method: 'POST',
    credentials: 'include',
  })
  const optionsJson = await optionsRes.json()
  if (!optionsRes.ok) throw new Error(optionsJson.error ?? 'Failed to start passkey registration')

  let attestation
  try {
    attestation = await startRegistration({
      optionsJSON: optionsJson.options as PublicKeyCredentialCreationOptionsJSON,
    })
  } catch (e) {
    if (isPreviouslyRegisteredError(e)) {
      // Same Face ID already on this Apple ID — re-link instead of creating a duplicate.
      await rebindPasskey(userId, unlockPassword)
      return
    }
    throw new Error(formatWebAuthnError(e))
  }

  const verifyRes = await fetch('/api/passkey/register/verify', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: attestation }),
  })
  const verifyJson = await verifyRes.json()
  if (!verifyRes.ok) throw new Error(verifyJson.error ?? 'Passkey registration failed')

  await wrapUnlockPassword(userId, unlockPassword, verifyJson.unlockKey as string)
}

/**
 * Enable Face ID / Touch ID on this device install.
 * If the authenticator was already registered (common after deleting/re-adding the PWA),
 * authenticate and re-wrap the unlock password instead of registering again.
 */
export async function registerPasskey(userId: string, unlockPassword: string): Promise<void> {
  const status = await fetchPasskeyStatus().catch(() => ({
    hasPasskey: false,
    count: 0,
    credentials: [],
  }))

  if (status.count > 0) {
    try {
      await rebindPasskey(userId, unlockPassword)
      return
    } catch (rebindErr) {
      // Keychain credential missing or user cancelled — try fresh registration.
      const msg = (rebindErr instanceof Error ? rebindErr.message : String(rebindErr)).toLowerCase()
      if (
        msg.includes('cancelled') ||
        msg.includes('canceled') ||
        msg.includes('not allowed') ||
        msg.includes('did not complete')
      ) {
        throw rebindErr instanceof Error ? rebindErr : new Error(formatWebAuthnError(rebindErr))
      }
    }
  }

  await registerNewPasskey(userId, unlockPassword)
}

export async function authenticatePasskey(): Promise<string> {
  const optionsRes = await fetch('/api/passkey/auth/options', {
    method: 'POST',
    credentials: 'include',
  })
  const optionsJson = await optionsRes.json()
  if (!optionsRes.ok) throw new Error(optionsJson.error ?? 'Failed to start passkey authentication')

  const rawOptions = optionsJson.options as PublicKeyCredentialRequestOptionsJSON
  const platformOptions: PublicKeyCredentialRequestOptionsJSON = {
    ...rawOptions,
    allowCredentials: rawOptions.allowCredentials?.map((cred) => ({
      ...cred,
      transports: ['internal'],
    })),
  }

  let assertion
  try {
    assertion = await startAuthentication({
      optionsJSON: platformOptions,
    })
  } catch (e) {
    throw new Error(formatWebAuthnError(e))
  }

  const verifyRes = await fetch('/api/passkey/auth/verify', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ response: assertion }),
  })
  const verifyJson = await verifyRes.json()
  if (!verifyRes.ok) throw new Error(verifyJson.error ?? 'Passkey authentication failed')

  return verifyJson.unlockKey as string
}

export async function removePasskey(params: {
  credentialId?: string
  removeAll?: boolean
}): Promise<void> {
  const res = await fetch('/api/passkey/remove', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to remove passkey')
}
