import { keccak256, stringToBytes } from 'viem'
import type { Address } from 'viem'
import type { HypercertMetadata, HypercertRequest, HypercertRequestStatus } from './types'
import {
  buildCreateRequestMessageCompact,
  buildMintRecordMessage,
  buildReviewMessage,
} from './request-signing'

const STORAGE_KEY = 'hypercert_requests'

function migrateRequest(r: HypercertRequest): HypercertRequest {
  if (r.hypercertId && r.status === 'APPROVED') {
    return { ...r, status: 'MINTED' as const }
  }
  return r
}

/** True while a request is waiting on verifiers or the user still needs to mint an approved cert. */
export function hasOpenHypercertWorkflow(requests: HypercertRequest[]): boolean {
  return requests.some(
    (req) =>
      req.status === 'PENDING' ||
      (req.status === 'APPROVED' && !req.hypercertId)
  )
}

function readLocalFallback(): HypercertRequest[] {
  if (typeof window === 'undefined') return []
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    const raw: HypercertRequest[] = stored ? JSON.parse(stored) : []
    return raw.map(migrateRequest)
  } catch {
    return []
  }
}

function writeLocalMirror(requests: HypercertRequest[]) {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  } catch {
    // ignore
  }
}

function mergeUniqueById(primary: HypercertRequest[], secondary: HypercertRequest[]): HypercertRequest[] {
  const map = new Map<string, HypercertRequest>()
  for (const r of secondary) map.set(r.id, r)
  for (const r of primary) map.set(r.id, r)
  return Array.from(map.values()).sort((a, b) => b.submittedAt - a.submittedAt)
}

export async function fetchHypercertRequestsByUser(
  primaryAddress: string,
  legacyAddress?: string
): Promise<HypercertRequest[]> {
  const primary = primaryAddress.toLowerCase()
  const legacy = legacyAddress?.toLowerCase()
  const local = readLocalFallback().filter((r) => {
    const req = r.requester.toLowerCase()
    return req === primary || (legacy != null && req === legacy)
  })
  try {
    const qs = new URLSearchParams({ requester: primaryAddress })
    if (legacyAddress) qs.set('legacyRequester', legacyAddress)
    const res = await fetch(`/api/hypercerts/requests?${qs.toString()}`, { cache: 'no-store' })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success || !Array.isArray(data.requests)) {
      return local
    }
    const remote = data.requests as HypercertRequest[]
    writeLocalMirror(mergeUniqueById(remote, readLocalFallback()))
    return remote
  } catch {
    return local
  }
}

export async function fetchHypercertRequestsByStatus(
  status: HypercertRequestStatus
): Promise<HypercertRequest[]> {
  const local = readLocalFallback().filter((r) => r.status === status)
  try {
    const res = await fetch(`/api/hypercerts/requests?status=${encodeURIComponent(status)}`, {
      cache: 'no-store',
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success || !Array.isArray(data.requests)) {
      return local
    }
    const remote = data.requests as HypercertRequest[]
    writeLocalMirror(mergeUniqueById(remote, readLocalFallback()))
    return remote
  } catch {
    return local
  }
}

/** @deprecated Prefer fetchHypercertRequestsByUser */
export function getAllHypercertRequests(): HypercertRequest[] {
  return readLocalFallback()
}

/** @deprecated Prefer fetchHypercertRequestsByStatus */
export function getHypercertRequestsByStatus(status: HypercertRequestStatus): HypercertRequest[] {
  return readLocalFallback().filter((req) => req.status === status)
}

/** @deprecated Prefer fetchHypercertRequestsByUser */
export function getHypercertRequestsByUser(address: string): HypercertRequest[] {
  return readLocalFallback().filter((req) => req.requester.toLowerCase() === address.toLowerCase())
}

export async function submitHypercertRequest(params: {
  requester: string
  metadata: HypercertMetadata
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>
}): Promise<HypercertRequest> {
  const metadataRaw = JSON.stringify(params.metadata)
  const metadataCommitment = keccak256(stringToBytes(metadataRaw)) as `0x${string}`
  const timestamp = Date.now()
  const message = buildCreateRequestMessageCompact({
    requester: params.requester as Address,
    metadataCommitment,
    timestamp,
  })
  const signature = await params.signMessageAsync({ message })

  const res = await fetch('/api/hypercerts/requests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requester: params.requester,
      metadataRaw,
      metadataCommitment,
      timestamp,
      signature,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success || !data?.request) {
    const msg = data?.error || 'Failed to submit Hypercert request'
    if (res.status === 503) {
      return submitHypercertRequestLocalFallback(params.requester, params.metadata)
    }
    throw new Error(msg)
  }

  const created = data.request as HypercertRequest
  const merged = mergeUniqueById([created], readLocalFallback())
  writeLocalMirror(merged)
  return created
}

function submitHypercertRequestLocalFallback(requester: string, metadata: HypercertMetadata): HypercertRequest {
  const existing = readLocalFallback().filter((r) => r.requester.toLowerCase() === requester.toLowerCase())
  if (hasOpenHypercertWorkflow(existing)) {
    throw new Error(
      'Finish your open Hypercert request first: wait for review, mint an approved certificate, or wait for a rejection before submitting a new request.'
    )
  }
  const request: HypercertRequest = {
    id: `${Date.now()}-${requester.slice(0, 8)}`,
    requester,
    metadata,
    status: 'PENDING',
    submittedAt: Date.now(),
  }
  const requests = [...readLocalFallback(), request]
  writeLocalMirror(requests)
  return request
}

export async function approveHypercertRequest(params: {
  requestId: string
  verifierAddress: string
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>
}): Promise<HypercertRequest | null> {
  const timestamp = Date.now()
  const message = buildReviewMessage({
    action: 'approve',
    requestId: params.requestId,
    reviewer: params.verifierAddress as Address,
    timestamp,
  })
  const signature = await params.signMessageAsync({ message })

  const res = await fetch('/api/hypercerts/requests/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: params.requestId,
      action: 'approve',
      reviewer: params.verifierAddress,
      timestamp,
      signature,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success || !data?.request) {
    if (res.status === 503) {
      return approveHypercertRequestLocal(params)
    }
    console.error('approveHypercertRequest:', data?.error)
    return null
  }
  const updated = data.request as HypercertRequest
  writeLocalMirror(mergeUniqueById([updated], readLocalFallback()))
  return updated
}

function approveHypercertRequestLocal(params: {
  requestId: string
  verifierAddress: string
}): HypercertRequest | null {
  const requests = readLocalFallback()
  const request = requests.find((req) => req.id === params.requestId)
  if (!request) return null
  request.status = 'APPROVED'
  request.reviewedAt = Date.now()
  request.reviewedBy = params.verifierAddress
  writeLocalMirror(requests)
  return request
}

export async function rejectHypercertRequest(params: {
  requestId: string
  verifierAddress: string
  reason?: string
  signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>
}): Promise<HypercertRequest | null> {
  const timestamp = Date.now()
  const message = buildReviewMessage({
    action: 'reject',
    requestId: params.requestId,
    reviewer: params.verifierAddress as Address,
    timestamp,
  })
  const signature = await params.signMessageAsync({ message })

  const res = await fetch('/api/hypercerts/requests/review', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      requestId: params.requestId,
      action: 'reject',
      reviewer: params.verifierAddress,
      timestamp,
      signature,
      reason: params.reason,
    }),
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok || !data?.success || !data?.request) {
    if (res.status === 503) {
      return rejectHypercertRequestLocal(params)
    }
    console.error('rejectHypercertRequest:', data?.error)
    return null
  }
  const updated = data.request as HypercertRequest
  writeLocalMirror(mergeUniqueById([updated], readLocalFallback()))
  return updated
}

function rejectHypercertRequestLocal(params: {
  requestId: string
  verifierAddress: string
  reason?: string
}): HypercertRequest | null {
  const requests = readLocalFallback()
  const request = requests.find((req) => req.id === params.requestId)
  if (!request) return null
  request.status = 'REJECTED'
  request.reviewedAt = Date.now()
  request.reviewedBy = params.verifierAddress
  request.rejectionReason = params.reason
  writeLocalMirror(requests)
  return request
}

export async function updateRequestWithHypercertId(
  requestId: string,
  hypercertId: string,
  txHash?: string,
  metadataCid?: string,
  opts?: {
    requester: string
    signMessageAsync: (args: { message: string }) => Promise<`0x${string}`>
  }
): Promise<HypercertRequest | null> {
  if (opts?.requester && opts.signMessageAsync && txHash && metadataCid) {
    const timestamp = Date.now()
    const message = buildMintRecordMessage({
      requestId,
      requester: opts.requester as Address,
      hypercertId,
      txHash,
      metadataCid,
      timestamp,
    })
    const signature = await opts.signMessageAsync({ message })

    const res = await fetch('/api/hypercerts/requests/mint', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requestId,
        requester: opts.requester,
        hypercertId,
        txHash,
        metadataCid,
        timestamp,
        signature,
      }),
    })

    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data?.success || !data?.request) {
      if (res.status === 503) {
        return updateRequestWithHypercertIdLocal(requestId, hypercertId, txHash, metadataCid)
      }
      console.error('updateRequestWithHypercertId:', data?.error)
      return null
    }
    const updated = data.request as HypercertRequest
    writeLocalMirror(mergeUniqueById([updated], readLocalFallback()))
    return updated
  }

  return updateRequestWithHypercertIdLocal(requestId, hypercertId, txHash, metadataCid)
}

function updateRequestWithHypercertIdLocal(
  requestId: string,
  hypercertId: string,
  txHash?: string,
  metadataCid?: string
): HypercertRequest | null {
  const requests = readLocalFallback()
  const request = requests.find((req) => req.id === requestId)
  if (!request) return null
  request.hypercertId = hypercertId
  request.status = 'MINTED'
  if (txHash) request.txHash = txHash
  if (metadataCid) request.metadataCid = metadataCid
  writeLocalMirror(requests)
  return request
}

export function clearAllHypercertRequests(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
  }
}
