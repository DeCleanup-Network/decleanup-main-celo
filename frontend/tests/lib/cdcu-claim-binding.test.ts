/**
 * @jest-environment ./tests/lib/node-window-environment.js
 */
jest.mock('server-only', () => ({}), { virtual: true })

const VICTIM = '0x1111111111111111111111111111111111111111'
const VICTIM_SAFE = '0x2222222222222222222222222222222222222222'
const ATTACKER = '0x3333333333333333333333333333333333333333'
const ATTACKER_SAFE = '0x4444444444444444444444444444444444444444'
const TX = `0x${'ab'.repeat(32)}`

const mockResolveWalletIdentity = jest.fn()
const mockPredictSafe = jest.fn()
jest.mock('@/lib/wallet/resolve-identity', () => ({
  resolveWalletIdentity: (...a: unknown[]) => mockResolveWalletIdentity(...a),
}))
jest.mock('@/lib/wallet/predict-safe-from-address', () => ({
  predictSafeAddressFromOwnerAddress: (...a: unknown[]) => mockPredictSafe(...a),
}))

const mockSign = jest.fn()
const mockEligibility = jest.fn()
const mockClaimsInTx = jest.fn()
const mockRecordIssued = jest.fn()
jest.mock('@/lib/cdcu/claim-signing', () => ({
  CLAIM_CATEGORY: { CleanupCampaign: 1 },
  getEligibilityAndClaimable: (...a: unknown[]) => mockEligibility(...a),
  signClaimVaultClaim: (...a: unknown[]) => mockSign(...a),
  getPendingWei: jest.fn(async () => 0n),
  setPendingWei: jest.fn(async () => undefined),
  getCleanupCampaignClaimsInTx: (...a: unknown[]) => mockClaimsInTx(...a),
  recordIssued: (...a: unknown[]) => mockRecordIssued(...a),
}))
const recorded = new Set<string>()
jest.mock('@/lib/cdcu/issued-store', () => ({
  markClaimTxRecorded: jest.fn(async (h: string) => {
    if (recorded.has(h)) return false
    recorded.add(h)
    return true
  }),
}))
jest.mock('@/lib/server/rate-limit', () => ({
  enforceApiRateLimit: jest.fn(async () => ({ ok: true })),
}))

function identityFor(input: string) {
  const i = input.toLowerCase()
  if (i === VICTIM.toLowerCase()) {
    return { publicAddress: VICTIM, eoaAddress: VICTIM, smartAccountAddress: VICTIM_SAFE }
  }
  // Attacker-made Safe whose first owner is the victim (or a forged DB link) resolves to the victim.
  if (i === ATTACKER_SAFE.toLowerCase()) {
    return { publicAddress: VICTIM, eoaAddress: VICTIM, smartAccountAddress: ATTACKER_SAFE }
  }
  return { publicAddress: input, eoaAddress: input, smartAccountAddress: null }
}

function post(body: unknown) {
  return new Request('http://localhost/api', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

beforeEach(() => {
  jest.clearAllMocks()
  recorded.clear()
  process.env.CLAIM_VAULT_AUTHORIZED_SIGNER_PRIVATE_KEY = `0x${'01'.repeat(32)}`
  process.env.NEXT_PUBLIC_CLAIMVAULT_ADDRESS = '0x4f69a1170c8799b5bc1587275b2e7da5a8406ff0'
  mockResolveWalletIdentity.mockImplementation(async (a: string) => identityFor(a))
  mockPredictSafe.mockImplementation(async (owner: string) =>
    owner.toLowerCase() === VICTIM.toLowerCase()
      ? VICTIM_SAFE
      : '0x5555555555555555555555555555555555555555'
  )
  mockEligibility.mockResolvedValue({
    eligible: true,
    claimableNextTrancheWei: 10n ** 20n,
    milestonesClaimed: 0,
  })
  mockSign.mockImplementation(async (p: { recipient: string; amount: bigint }) => ({
    ...p,
    v: 27,
    r: '0x01',
    s: '0x02',
  }))
})

describe('claim-auth', () => {
  it('allows only the reward EOA and its canonical Safe', async () => {
    const { resolveClaimIdentity, isAllowedRecipient } = await import('@/lib/cdcu/claim-auth')
    const id = await resolveClaimIdentity(ATTACKER_SAFE)
    expect(id.rewardIdentity.toLowerCase()).toBe(VICTIM.toLowerCase())
    expect(isAllowedRecipient(id, VICTIM)).toBe(true)
    expect(isAllowedRecipient(id, VICTIM_SAFE)).toBe(true)
    expect(isAllowedRecipient(id, ATTACKER_SAFE)).toBe(false)
    expect(isAllowedRecipient(id, ATTACKER)).toBe(false)
  })

  it('falls back to EOA only when Safe prediction fails', async () => {
    mockPredictSafe.mockRejectedValueOnce(new Error('rpc down'))
    const { resolveClaimIdentity, isAllowedRecipient } = await import('@/lib/cdcu/claim-auth')
    const id = await resolveClaimIdentity(VICTIM)
    expect(isAllowedRecipient(id, VICTIM)).toBe(true)
    expect(isAllowedRecipient(id, VICTIM_SAFE)).toBe(false)
  })
})

describe('POST /api/cdcu/claim-request', () => {
  it("rejects paying another user's points to a third-party wallet", async () => {
    const { POST } = await import('@/app/api/cdcu/claim-request/route')
    const res = await POST(post({ source: VICTIM, recipient: ATTACKER }) as never)
    expect(res.status).toBe(403)
    expect(mockSign).not.toHaveBeenCalled()
  })

  it('signs for the owner EOA (unchanged dashboard flow)', async () => {
    const { POST } = await import('@/app/api/cdcu/claim-request/route')
    const res = await POST(post({ source: VICTIM, recipient: VICTIM }) as never)
    expect(res.status).toBe(200)
    expect(mockSign.mock.calls[0][0].recipient.toLowerCase()).toBe(VICTIM.toLowerCase())
  })

  it('pays the resolved owner EOA when a non-canonical smart wallet claims for itself', async () => {
    const { POST } = await import('@/app/api/cdcu/claim-request/route')
    const res = await POST(post({ source: ATTACKER_SAFE, recipient: ATTACKER_SAFE }) as never)
    expect(res.status).toBe(200)
    expect(mockSign.mock.calls[0][0].recipient.toLowerCase()).toBe(VICTIM.toLowerCase())
  })
})

describe('POST /api/cdcu/record-issued', () => {
  it('requires a tx hash', async () => {
    const { POST } = await import('@/app/api/cdcu/record-issued/route')
    const res = await POST(post({ recipient: VICTIM, amount: '100' }))
    expect(res.status).toBe(400)
    expect(mockRecordIssued).not.toHaveBeenCalled()
  })

  it('rejects a tx without a matching claim', async () => {
    mockClaimsInTx.mockResolvedValue([{ recipient: ATTACKER, amount: 100n }])
    const { POST } = await import('@/app/api/cdcu/record-issued/route')
    const res = await POST(post({ recipient: VICTIM, amount: '100', txHash: TX }))
    expect(res.status).toBe(400)
    expect(mockRecordIssued).not.toHaveBeenCalled()
  })

  it('records a matching claim once', async () => {
    mockClaimsInTx.mockResolvedValue([{ recipient: VICTIM, amount: 100n }])
    const { POST } = await import('@/app/api/cdcu/record-issued/route')
    const first = await POST(post({ recipient: VICTIM, amount: '100', txHash: TX }))
    const second = await POST(post({ recipient: VICTIM, amount: '100', txHash: TX }))
    expect(first.status).toBe(200)
    expect(await second.json()).toEqual({ ok: true, alreadyRecorded: true })
    expect(mockRecordIssued).toHaveBeenCalledTimes(1)
  })
})
