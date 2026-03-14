import { HypercertRequest, HypercertRequestStatus } from './types'

const STORAGE_KEY = 'hypercert_requests'

// Get all requests from localStorage
export function getAllHypercertRequests(): HypercertRequest[] {
  if (typeof window === 'undefined') return []
  
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Error reading Hypercert requests:', error)
    return []
  }
}

// Get requests by status
export function getHypercertRequestsByStatus(status: HypercertRequestStatus): HypercertRequest[] {
  return getAllHypercertRequests().filter(req => req.status === status)
}

// Get requests by requester address
export function getHypercertRequestsByUser(address: string): HypercertRequest[] {
  return getAllHypercertRequests().filter(
    req => req.requester.toLowerCase() === address.toLowerCase()
  )
}

// Submit a new Hypercert request
export function submitHypercertRequest(params: {
  requester: string
  metadata: any
}): HypercertRequest {
  const request: HypercertRequest = {
    id: `${Date.now()}-${params.requester.slice(0, 8)}`,
    requester: params.requester,
    metadata: params.metadata,
    status: 'PENDING',
    submittedAt: Date.now(),
  }

  const requests = getAllHypercertRequests()
  requests.push(request)
  
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  }

  console.log('✅ Hypercert request submitted:', request.id)
  return request
}

// Approve a request (verifier action)
export function approveHypercertRequest(params: {
  requestId: string
  verifierAddress: string
}): HypercertRequest | null {
  const requests = getAllHypercertRequests()
  const request = requests.find(req => req.id === params.requestId)
  
  if (!request) {
    console.error('Request not found:', params.requestId)
    return null
  }

  request.status = 'APPROVED'
  request.reviewedAt = Date.now()
  request.reviewedBy = params.verifierAddress

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  }

  console.log('✅ Hypercert request approved:', request.id)
  return request
}

// Reject a request (verifier action)
export function rejectHypercertRequest(params: {
  requestId: string
  verifierAddress: string
  reason?: string
}): HypercertRequest | null {
  const requests = getAllHypercertRequests()
  const request = requests.find(req => req.id === params.requestId)
  
  if (!request) {
    console.error('Request not found:', params.requestId)
    return null
  }

  request.status = 'REJECTED'
  request.reviewedAt = Date.now()
  request.reviewedBy = params.verifierAddress
  request.rejectionReason = params.reason

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  }

  console.log('❌ Hypercert request rejected:', request.id)
  return request
}

// Update a request with minted Hypercert ID (user action after minting)
export function updateRequestWithHypercertId(
  requestId: string,
  hypercertId: string
): HypercertRequest | null {
  const requests = getAllHypercertRequests()
  const request = requests.find(req => req.id === requestId)
  
  if (!request) {
    console.error('Request not found:', requestId)
    return null
  }

  request.hypercertId = hypercertId

  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(requests))
  }

  console.log('✅ Request updated with Hypercert ID:', {
    requestId,
    hypercertId,
  })
  
  return request
}

// Clear all requests (for testing)
export function clearAllHypercertRequests(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem(STORAGE_KEY)
    console.log('🗑️ All Hypercert requests cleared')
  }
}