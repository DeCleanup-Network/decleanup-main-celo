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

export async function registerPasskey(userId: string, unlockPassword: string): Promise<void> {
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

export async function authenticatePasskey(): Promise<string> {
  const optionsRes = await fetch('/api/passkey/auth/options', {
    method: 'POST',
    credentials: 'include',
  })
  const optionsJson = await optionsRes.json()
  if (!optionsRes.ok) throw new Error(optionsJson.error ?? 'Failed to start passkey authentication')

  let assertion
  try {
    assertion = await startAuthentication({
      optionsJSON: optionsJson.options as PublicKeyCredentialRequestOptionsJSON,
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

export async function removePasskey(params: { credentialId?: string; removeAll?: boolean }): Promise<void> {
  const res = await fetch('/api/passkey/remove', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to remove passkey')
}
