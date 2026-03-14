# DeCleanup Hypercerts - Launch Execution Plan
**Date Created:** 2026-02-18  
**Target Launch:** 2026-02-25 (7 days)  
**Status:** Ready to Execute  
**Owner:** Engineering Team

---

## EXECUTIVE SUMMARY

Moving from **Feature Complete** → **Launch Ready**

**Current State:** Features work, architecture solid, ops baseline missing

**Launch Blockers (from Anastasia Lumina):**
1. ❌ Mainnet contracts deployed
2. ❌ grantRole integrated securely
3. ❌ Persistent database implemented
4. ❌ Admin authentication enforced
5. ❌ E2E mainnet test passed
6. ❌ Governance pool funded
7. ❌ Production documentation complete

**Timeline:** 7 focused days (not months)

**Confidence after completion:** 90%+

---

## PHASE 9: CRITICAL PATH (Days 1-2)
*Security + Persistence Foundation*

### 1️⃣ DATABASE LAYER - Supabase Setup

**Status:** 🔴 NOT STARTED

**Why this first:** Everything else depends on persistence

**Supabase Setup (30 min)**
```sql
-- Create tables
CREATE TABLE verifier_applications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  address VARCHAR(42) NOT NULL UNIQUE,
  applied_at BIGINT NOT NULL,
  status VARCHAR(20) NOT NULL ('PENDING'|'APPROVED'|'REJECTED'),
  reviewed_by VARCHAR(42),
  reviewed_at BIGINT,
  notes TEXT,
  tx_hash VARCHAR(66), -- grantRole tx
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE verifier_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  application_id UUID REFERENCES verifier_applications(id),
  action VARCHAR(50) NOT NULL,
  actor_address VARCHAR(42) NOT NULL,
  details JSONB,
  timestamp TIMESTAMP DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_verifier_address ON verifier_applications(address);
CREATE INDEX idx_verifier_status ON verifier_applications(status);
CREATE INDEX idx_audit_app_id ON verifier_audit_log(application_id);
```

**Tasks:**
- [ ] Create Supabase project
- [ ] Run SQL above
- [ ] Get connection string
- [ ] Test connection
- [ ] Document credentials (secure storage)

**Acceptance:** Database accessible, tables exist, can query

---

### 2️⃣ MIGRATE CODE - In-Memory → Supabase

**Status:** 🔴 NOT STARTED

**Replace:** `frontend/src/lib/verifier/applications.ts`

```typescript
// NEW: applications-supabase.ts

import { createClient } from '@supabase/supabase-js'
import { VerifierApplication } from './types'
import { Address } from 'viem'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

/**
 * Create application in database
 */
export async function createApplication(address: string): Promise<VerifierApplication> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .insert({
      address: address.toLowerCase(),
      applied_at: Date.now(),
      status: 'PENDING',
    })
    .select()
    .single()

  if (error) throw new Error(`Failed to create application: ${error.message}`)

  return {
    id: data.id,
    address: data.address,
    appliedAt: data.applied_at,
    status: data.status as 'PENDING' | 'APPROVED' | 'REJECTED',
  }
}

/**
 * Get application by ID
 */
export async function getApplicationById(id: string): Promise<VerifierApplication | null> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select()
    .eq('id', id)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  return {
    id: data.id,
    address: data.address,
    appliedAt: data.applied_at,
    status: data.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    notes: data.notes,
  }
}

/**
 * Get application by address (latest)
 */
export async function getLatestApplicationByAddress(address: string): Promise<VerifierApplication | null> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select()
    .eq('address', address.toLowerCase())
    .order('applied_at', { ascending: false })
    .limit(1)
    .single()

  if (error && error.code !== 'PGRST116') throw error
  if (!data) return null

  return {
    id: data.id,
    address: data.address,
    appliedAt: data.applied_at,
    status: data.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    notes: data.notes,
  }
}

/**
 * Update application status
 */
export async function updateApplicationStatus(
  id: string,
  status: 'APPROVED' | 'REJECTED',
  reviewedBy: string,
  notes?: string
): Promise<VerifierApplication | null> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .update({
      status,
      reviewed_by: reviewedBy.toLowerCase(),
      reviewed_at: Date.now(),
      notes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw new Error(`Failed to update application: ${error.message}`)

  return {
    id: data.id,
    address: data.address,
    appliedAt: data.applied_at,
    status: data.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reviewedBy: data.reviewed_by,
    reviewedAt: data.reviewed_at,
    notes: data.notes,
  }
}

/**
 * Get all applications (admin)
 */
export async function getAllApplications(): Promise<VerifierApplication[]> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .select()
    .order('applied_at', { ascending: false })

  if (error) throw new Error(`Failed to fetch applications: ${error.message}`)

  return data.map(row => ({
    id: row.id,
    address: row.address,
    appliedAt: row.applied_at,
    status: row.status as 'PENDING' | 'APPROVED' | 'REJECTED',
    reviewedBy: row.reviewed_by,
    reviewedAt: row.reviewed_at,
    notes: row.notes,
  }))
}

/**
 * Log audit event
 */
export async function logAuditEvent(
  applicationId: string,
  action: string,
  actor: string,
  details?: any
): Promise<void> {
  const { error } = await supabase
    .from('verifier_audit_log')
    .insert({
      application_id: applicationId,
      action,
      actor_address: actor.toLowerCase(),
      details: details || {},
    })

  if (error) {
    console.error('Failed to log audit:', error)
  }
}
```

**Tasks:**
- [ ] Create `applications-supabase.ts`
- [ ] Update API routes to use new functions
- [ ] Add environment variables (SUPABASE_URL, ANON_KEY)
- [ ] Test database operations
- [ ] Delete old `applications.ts`

**Acceptance:** All CRUD operations work, data persists across restarts

---

### 3️⃣ ADMIN ROLE VERIFICATION - Middleware

**Status:** 🔴 NOT STARTED

**Create:** `frontend/src/lib/verifier/admin-check.ts`

```typescript
/**
 * Verify admin role on-chain
 * Called from API routes before processing admin actions
 */

import { readContract } from 'wagmi/actions'
import { config } from '@/lib/blockchain/wagmi'
import { Address } from 'viem'

const SUBMISSION_ADDRESS = process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT as Address | undefined

const MINIMAL_ABI = [
  {
    type: 'function',
    name: 'DEFAULT_ADMIN_ROLE',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'bytes32' }],
  },
  {
    type: 'function',
    name: 'hasRole',
    stateMutability: 'view',
    inputs: [
      { type: 'bytes32', name: 'role' },
      { type: 'address', name: 'account' },
    ],
    outputs: [{ type: 'bool' }],
  },
] as const

/**
 * Check if address is admin on-chain
 * MUST be called for every protected route
 */
export async function isAdminOnChain(address: string | Address): Promise<boolean> {
  if (!address || typeof address !== 'string') {
    console.warn('Invalid address for admin check:', address)
    return false
  }

  if (!SUBMISSION_ADDRESS) {
    console.error('SUBMISSION_ADDRESS not configured')
    return false
  }

  try {
    const adminRole = (await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: MINIMAL_ABI,
      functionName: 'DEFAULT_ADMIN_ROLE',
    })) as `0x${string}`

    const isAdmin = (await readContract(config, {
      address: SUBMISSION_ADDRESS,
      abi: MINIMAL_ABI,
      functionName: 'hasRole',
      args: [adminRole, address as Address],
    })) as boolean

    if (!isAdmin) {
      console.warn(`Non-admin tried to access protected endpoint: ${address}`)
    }

    return isAdmin
  } catch (error) {
    console.error('Error checking admin role:', error)
    return false
  }
}
```

**Update API routes:**

```typescript
// frontend/src/app/api/verifier/review/route.ts

import { isAdminOnChain } from '@/lib/verifier/admin-check'
import { logAuditEvent } from '@/lib/verifier/applications-supabase'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { applicationId, decision, reviewedBy, notes } = body

    // VALIDATION
    if (!applicationId || !decision) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    if (!['APPROVE', 'REJECT'].includes(decision)) {
      return NextResponse.json({ error: 'Invalid decision' }, { status: 400 })
    }

    if (!reviewedBy) {
      return NextResponse.json({ error: 'Missing reviewedBy' }, { status: 400 })
    }

    // 🔴 CRITICAL: Admin role check (on-chain)
    const isAdmin = await isAdminOnChain(reviewedBy)
    if (!isAdmin) {
      console.warn(`⛔ Non-admin rejected: ${reviewedBy}`)
      await logAuditEvent(applicationId, 'UNAUTHORIZED_ATTEMPT', reviewedBy, {
        reason: 'Not admin role',
      })
      return NextResponse.json(
        { error: 'Unauthorized. Only admins can review applications.' },
        { status: 403 }
      )
    }

    // Get application from DB
    const app = await getApplicationById(applicationId)
    if (!app) {
      return NextResponse.json({ error: 'Application not found' }, { status: 404 })
    }

    // Check status
    if (app.status !== 'PENDING') {
      return NextResponse.json(
        { error: `Application already ${app.status.toLowerCase()}` },
        { status: 409 }
      )
    }

    // If APPROVE: grant role on-chain
    if (decision === 'APPROVE') {
      try {
        const txHash = await grantVerifierRole(app.address as `0x${string}`)
        console.log(`✅ VERIFIER_ROLE granted to ${app.address}: ${txHash}`)

        // Update DB with tx hash
        const updated = await updateApplicationStatus(
          applicationId,
          'APPROVED',
          reviewedBy,
          notes
        )

        // Audit log
        await logAuditEvent(applicationId, 'APPROVED', reviewedBy, {
          tx_hash: txHash,
          notes,
        })

        return NextResponse.json({
          success: true,
          application: updated,
          message: 'Application approved and role granted on-chain',
        })
      } catch (error: any) {
        const msg = error?.message || String(error)
        console.error(`❌ Failed to grant role: ${msg}`)

        await logAuditEvent(applicationId, 'APPROVAL_FAILED', reviewedBy, {
          error: msg,
        })

        return NextResponse.json(
          { error: `Failed to grant role: ${msg}` },
          { status: 500 }
        )
      }
    }

    // If REJECT
    if (decision === 'REJECT') {
      const updated = await updateApplicationStatus(
        applicationId,
        'REJECTED',
        reviewedBy,
        notes
      )

      await logAuditEvent(applicationId, 'REJECTED', reviewedBy, { notes })

      return NextResponse.json({
        success: true,
        application: updated,
        message: 'Application rejected',
      })
    }

  } catch (error) {
    console.error('Error in POST /api/verifier/review:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
```

**Tasks:**
- [ ] Create `admin-check.ts`
- [ ] Update `/api/verifier/review`
- [ ] Add audit logging
- [ ] Test with non-admin wallet (should fail)
- [ ] Test with admin wallet (should succeed)

**Acceptance:** Non-admin request rejected with 403, admin request processed

---

### 4️⃣ PREVENT RACE CONDITIONS

**Status:** 🔴 NOT STARTED

**Add to database:**

```sql
ALTER TABLE verifier_applications 
ADD COLUMN processing BOOLEAN DEFAULT FALSE;
```

**Update code:**

```typescript
/**
 * Atomic lock for processing
 */
export async function lockApplication(id: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('verifier_applications')
    .update({ processing: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('processing', false) // Only if not already processing
    .select()

  if (error) {
    console.error('Failed to lock application:', error)
    return false
  }

  return data.length > 0 // True if lock succeeded
}

/**
 * Release lock
 */
export async function unlockApplication(id: string): Promise<void> {
  await supabase
    .from('verifier_applications')
    .update({ processing: false })
    .eq('id', id)
}
```

**Use in review endpoint:**

```typescript
const locked = await lockApplication(applicationId)
if (!locked) {
  return NextResponse.json(
    { error: 'Application is being processed. Try again.' },
    { status: 409 }
  )
}

try {
  // Process...
  // Grant role, update DB, etc
} finally {
  await unlockApplication(applicationId)
}
```

**Tasks:**
- [ ] Add `processing` column to DB
- [ ] Implement lock/unlock functions
- [ ] Use in review endpoint
- [ ] Test concurrent requests (should only process once)

**Acceptance:** Only one approval process per application, others rejected

---

## PHASE 9.5: PRODUCTION HARDENING (Days 2-3)

### 5️⃣ PERSISTENT AGGREGATION

**Status:** 🔴 NOT STARTED

**Create table:**

```sql
CREATE TABLE impact_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  snapshot_date DATE NOT NULL,
  generated_at TIMESTAMP NOT NULL,
  total_cleanups INT,
  total_contributors INT,
  total_area_sqm FLOAT,
  total_weight_kg FLOAT,
  total_bags INT,
  total_time_minutes INT,
  top_locations JSONB,
  waste_breakdown JSONB,
  sdg_impact JSONB,
  raw_data JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_snapshot_date ON impact_snapshots(snapshot_date);
```

**Add daily cron job (using GitHub Actions or Vercel Cron):**

```typescript
// pages/api/cron/aggregation.ts

export const config = {
  runtime: 'nodejs',
}

/**
 * Runs daily: 00:00 UTC
 * Triggers aggregation and stores snapshot
 */
export default async function handler(req: NextRequest) {
  // Verify request is from cron (check secret)
  const secret = req.headers.get('authorization')
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get aggregation
    const aggregate = await getImpactIndex()

    // Store snapshot
    const { error } = await supabase
      .from('impact_snapshots')
      .insert({
        snapshot_date: new Date().toISOString().split('T')[0],
        generated_at: new Date().toISOString(),
        total_cleanups: aggregate.totalCleanups,
        total_contributors: aggregate.uniqueContributors,
        total_area_sqm: aggregate.totalAreaNormalized,
        total_weight_kg: aggregate.totalWeightNormalized,
        total_bags: aggregate.totalBags,
        total_time_minutes: aggregate.totalTimeMinutes,
        top_locations: aggregate.topLocations,
        waste_breakdown: aggregate.wasteTypeBreakdown,
        sdg_impact: aggregate.sdgImpact,
        raw_data: aggregate,
      })

    if (error) {
      console.error('Failed to store snapshot:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, message: 'Snapshot stored' })
  } catch (error) {
    console.error('Aggregation cron failed:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
```

**Configure in `vercel.json`:**

```json
{
  "crons": [
    {
      "path": "/api/cron/aggregation",
      "schedule": "0 0 * * *"
    }
  ]
}
```

**Tasks:**
- [ ] Create `impact_snapshots` table
- [ ] Create cron endpoint
- [ ] Configure Vercel crons
- [ ] Test cron job manually
- [ ] Verify snapshots persisted after restart

**Acceptance:** Daily snapshots stored in DB, survive server restarts

---

### 6️⃣ RATE LIMITING + VALIDATION

**Status:** 🔴 NOT STARTED

**Install dependencies:**

```bash
npm install zod next-rate-limit
```

**Create validation schemas:**

```typescript
// lib/validation/schemas.ts

import { z } from 'zod'

export const VerifyApplySchema = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  metrics: z.object({
    level: z.number().int().min(0),
    dcuBalance: z.number().min(0),
    approvedCleanups: z.number().int().min(0),
  }),
})

export const VerifyReviewSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewedBy: z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address'),
  notes: z.string().optional(),
})
```

**Add rate limiting middleware:**

```typescript
// lib/middleware/rate-limit.ts

import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
})

// 10 requests per hour per address
const ratelimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  analytics: true,
})

export async function checkRateLimit(address: string) {
  const { success, pending, reset, remaining, limit } = await ratelimit.limit(
    `verifier:apply:${address.toLowerCase()}`
  )

  return { success, remaining, limit, reset }
}
```

**Use in routes:**

```typescript
// api/verifier/apply/route.ts

import { VerifyApplySchema } from '@/lib/validation/schemas'
import { checkRateLimit } from '@/lib/middleware/rate-limit'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate input
    const parsed = VerifyApplySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.errors },
        { status: 400 }
      )
    }

    const { address, metrics } = parsed.data

    // Check rate limit
    const rateLimit = await checkRateLimit(address)
    if (!rateLimit.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil(rateLimit.reset / 1000)),
          },
        }
      )
    }

    // Rest of logic...
  } catch (error) {
    // ...
  }
}
```

**Tasks:**
- [ ] Install dependencies (zod, upstash)
- [ ] Create validation schemas
- [ ] Create rate limit middleware
- [ ] Update apply route with validation + rate limit
- [ ] Update review route with validation
- [ ] Test invalid inputs (should fail)
- [ ] Test rate limits (11th request should fail)

**Acceptance:** Invalid inputs rejected, rate limits enforced

---

## PHASE 10: MAINNET VALIDATION (Day 4)

### 7️⃣ DEPLOY CONTRACTS - MAINNET

**Status:** 🔴 NOT STARTED

**Prerequisites:**
- [ ] Submission contract code finalized
- [ ] Token contract code finalized
- [ ] Constructor args defined
- [ ] Deployment addresses documented

**Deployment Steps:**

```bash
# Install Hardhat or Forge
npm install hardhat @nomicfoundation/hardhat-toolbox

# Verify on Celo Mainnet
# 1. Deploy Submission Contract
# 2. Verify on explorer
# 3. Deploy Token Contract
# 4. Verify on explorer
# 5. Document addresses
```

**Post-deployment checklist:**
- [ ] Submission contract verified on explorer
- [ ] Token contract verified on explorer
- [ ] Admin role roles configured
- [ ] Minter role configured (if applicable)
- [ ] Ownership transferred (if applicable)
- [ ] Update frontend constants

**File:** `MAINNET_ADDRESSES.md`
```markdown
# Mainnet Addresses (Celo)

## Submission Contract
- Address: 0x...
- Explorer: https://explorer.celo.org/mainnet/address/0x...
- Verified: ✅

## Token Contract
- Address: 0x...
- Explorer: https://explorer.celo.org/mainnet/address/0x...
- Verified: ✅

## Roles
- DEFAULT_ADMIN_ROLE: 0x...
- VERIFIER_ROLE: 0x...
- MINTER_ROLE: 0x...
```

**Tasks:**
- [ ] Deploy Submission contract
- [ ] Verify on explorer
- [ ] Deploy Token contract
- [ ] Verify on explorer
- [ ] Configure roles
- [ ] Update frontend constants
- [ ] Document all addresses

**Acceptance:** Both contracts deployed, verified, roles configured

---

### 8️⃣ FRONTEND - MAINNET CONFIG

**Status:** 🔴 NOT STARTED

**Update:** `frontend/src/lib/blockchain/wagmi.ts`

```typescript
export const CONTRACT_ADDRESSES = {
  SUBMISSION: process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT_MAINNET,
  IMPACT_PRODUCT: process.env.NEXT_PUBLIC_IMPACT_PRODUCT_MAINNET,
  REWARD_MANAGER: process.env.NEXT_PUBLIC_REWARD_MANAGER_MAINNET,
  TOKEN: process.env.NEXT_PUBLIC_TOKEN_CONTRACT_MAINNET,
} as const

// Validate at startup
function validateContractAddresses() {
  const required = ['SUBMISSION', 'IMPACT_PRODUCT', 'REWARD_MANAGER', 'TOKEN']
  const missing = required.filter(key => !CONTRACT_ADDRESSES[key as keyof typeof CONTRACT_ADDRESSES])
  
  if (missing.length > 0) {
    throw new Error(`Missing contract addresses: ${missing.join(', ')}`)
  }
}

validateContractAddresses()
```

**Update:** `.env.production`

```env
NEXT_PUBLIC_SUBMISSION_CONTRACT_MAINNET=0x...
NEXT_PUBLIC_IMPACT_PRODUCT_MAINNET=0x...
NEXT_PUBLIC_REWARD_MANAGER_MAINNET=0x...
NEXT_PUBLIC_TOKEN_CONTRACT_MAINNET=0x...
NEXT_PUBLIC_CHAIN_ID=42220  # Celo Mainnet
NEXT_PUBLIC_RPC_URL=https://forno.celo.org
```

**Build & Deploy:**

```bash
npm run build
# Verify no errors
npm run start
# Test locally
```

**Smoke tests:**
- [ ] Can connect wallet
- [ ] Can read contract state
- [ ] Can see mainnet addresses in console
- [ ] No testnet references in production build

**Tasks:**
- [ ] Update environment variables
- [ ] Build production
- [ ] Smoke test locally
- [ ] Remove testnet configs
- [ ] Verify all addresses correct

**Acceptance:** Production build has mainnet addresses, no testnet references

---

### 9️⃣ FULL E2E MAINNET TEST

**Status:** 🔴 NOT STARTED

**Test Sequence (must pass in order):**

```
1. ✓ User A submits cleanup (image + location)
2. ✓ Admin approves cleanup (on-chain)
3. ✓ User A creates Hypercert request
4. ✓ Admin approves Hypercert request
5. ✓ User A mints Hypercert (on-chain)
6. ✓ User B applies to be verifier
7. ✓ Admin approves User B → grantRole called (on-chain)
8. ✓ Confirm User B has VERIFIER_ROLE (check on-chain)
9. ✓ User B verifies User A's cleanup
10. ✓ Impact API returns aggregated data
11. ✓ Verify data persists after server restart
```

**Test Script (manual checklist):**

```markdown
# Full E2E Mainnet Test

## Setup
- [ ] Deploy all contracts
- [ ] Fund test wallets with cELO
- [ ] Configure frontend for mainnet
- [ ] Start server

## Cleanup Submission
- [ ] User A (wallet A) submits cleanup
  - Before photo: [IPFS hash]
  - After photo: [IPFS hash]
  - Location: -23.5505, -46.6333 (São Paulo)
  - Impact: Area, weight, bags
- [ ] User A sees "Pending Verification"
- [ ] Check on-chain: submission ID recorded

## Cleanup Approval
- [ ] Admin (wallet ADMIN) logs in
- [ ] Sees "Pending Cleanups"
- [ ] Reviews User A's submission
- [ ] Approves cleanup
- [ ] Check on-chain: status changed to APPROVED
- [ ] User A sees status updated

## Hypercert Creation
- [ ] User A creates Hypercert request
- [ ] Metadata uploaded to IPFS
- [ ] Request shows PENDING

## Hypercert Approval
- [ ] Admin approves Hypercert request
- [ ] Check on-chain: request status APPROVED

## Hypercert Minting
- [ ] User A clicks "Mint Hypercert"
- [ ] Metadata uploaded
- [ ] SDK mints on-chain
- [ ] Confirm Hypercert ID returned
- [ ] Check on explorer: Hypercert exists

## Verifier Application
- [ ] User B (wallet B) visits dashboard
- [ ] User B sees "Apply to be Verifier" (if eligible)
- [ ] User B clicks Apply
- [ ] Application created in DB
- [ ] Admin sees pending application

## Verifier Approval
- [ ] Admin approves User B's application
- [ ] grantRole() called on-chain
- [ ] Wait for tx confirmation
- [ ] Check on-chain: User B has VERIFIER_ROLE
- [ ] User B sees "You are now a verifier"

## Cleanup Verification
- [ ] User B (verifier) logs in
- [ ] User B sees "Pending Cleanups"
- [ ] User B verifies User A's cleanup
- [ ] Check on-chain: verification recorded

## Impact API
- [ ] Call GET /api/impact/global
- [ ] Response includes:
  - totalCleanups: 1
  - totalContributors: 1
  - totalArea: > 0
  - totalWeight: > 0
- [ ] Call GET /api/impact/monthly
- [ ] Data matches global

## Persistence Test
- [ ] Restart server
- [ ] Call GET /api/impact/global again
- [ ] Data persists (not lost)
- [ ] Database snapshot exists

## Audit Trail
- [ ] Check verifier_audit_log table
- [ ] Records exist for:
  - User A submit cleanup
  - Admin approve cleanup
  - Admin approve verifier
  - User B verify cleanup
```

**Documentation:**

Create `TEST_RESULTS.md` with:
- Test date
- Contracts used
- Wallets used
- Transaction hashes
- Screenshots
- Any issues encountered

**Tasks:**
- [ ] Run full E2E flow
- [ ] Document all tx hashes
- [ ] Check all on-chain state
- [ ] Verify data persistence
- [ ] Record in TEST_RESULTS.md

**Acceptance:** All 11 steps pass, data persists, audit trail complete

---

## PHASE 11: GOVERNANCE (Day 5)

### 🔟 GOVERNANCE POOL - FUNDING

**Status:** 🔴 NOT STARTED

**Setup:**
- [ ] Open governance proposal pool (if using Snapshot or on-chain)
- [ ] Fund with $500 equivalent (in cELO or stable)
- [ ] Create first proposal (e.g., "Approve launch parameters")
- [ ] Document governance mechanics

**Tasks:**
- [ ] Deploy governance contracts (if needed)
- [ ] Fund pool wallet with $500
- [ ] Create example proposal
- [ ] Verify proposal visible on-chain or Snapshot
- [ ] Document process

**Acceptance:** Pool funded, proposal created, visible publicly

---

## PHASE 12: DOCUMENTATION (Days 5-6)

### 1️⃣1️⃣ PRODUCTION DOCUMENTATION

**Minimum Required:**

```markdown
# 1. Architecture Overview (2 pages)
- System diagram (cleanup → hypercert → verifier → impact)
- Contract interactions
- Role structure
- Data flow

# 2. Contract Interaction Flow (3 pages)
- Submission contract: createSubmission → approveSubmission → attachRecyclables
- Token contract: mint → transfer
- Governance: propose → vote → execute

# 3. Verifier Process (2 pages)
- How to become verifier
- Requirements (level, DCU, cleanups)
- Application flow
- Role grant mechanics

# 4. Token & Governance (2 pages)
- Token utility
- Governance pool mechanics
- Proposal process
- Timeline

# 5. Deployment Checklist (1 page)
- Pre-launch
- Launch day
- Post-launch monitoring

# 6. Troubleshooting (1 page)
- Common errors
- How to fix
- Support contact
```

**Files to create:**
- [ ] `ARCHITECTURE.md`
- [ ] `CONTRACT_INTERACTION.md`
- [ ] `VERIFIER_GUIDE.md`
- [ ] `TOKEN_GOVERNANCE.md`
- [ ] `DEPLOYMENT_CHECKLIST.md`
- [ ] `TROUBLESHOOTING.md`

**Tasks:**
- [ ] Write architecture overview
- [ ] Document all contract flows
- [ ] Create verifier step-by-step guide
- [ ] Explain token utility
- [ ] Create deployment checklist
- [ ] Add to README

**Acceptance:** All 6 docs exist, are clear, can be followed

---

## EXECUTION TIMELINE

### WEEK OF LAUNCH (Feb 18-25, 2026)

| Day | Phase | Focus | Status |
|-----|-------|-------|--------|
| Mon (18) | Phase 9 | Database + Admin Auth | 🔴 |
| Tue (19) | Phase 9 | grantRole Integration + Race Conditions | 🔴 |
| Wed (20) | Phase 9.5 | Persistence + Rate Limiting | 🔴 |
| Thu (21) | Phase 10 | Deploy Contracts + E2E Test | 🔴 |
| Fri (22) | Phase 11 | Governance Pool | 🔴 |
| Sat (23) | Phase 12 | Documentation | 🔴 |
| Sun (24) | Phase 12 | Final Testing + Fix Issues | 🔴 |
| Mon (25) | LAUNCH | Mainnet Live | 🟢 |

---

## LAUNCH READINESS CHECKLIST

**Database & Persistence:**
- [ ] Supabase configured
- [ ] All tables created
- [ ] Applications persist
- [ ] Aggregation snapshots persist
- [ ] Audit log complete

**Security:**
- [ ] Admin role verified on-chain
- [ ] Race conditions prevented
- [ ] Rate limiting enforced
- [ ] Input validation (Zod)
- [ ] No security issues in code review

**Smart Contracts:**
- [ ] Submission contract deployed (mainnet)
- [ ] Token contract deployed (mainnet)
- [ ] Verified on explorer
- [ ] Roles configured
- [ ] grantRole working

**Frontend:**
- [ ] Mainnet addresses configured
- [ ] RPC endpoint correct
- [ ] Chain ID correct
- [ ] No testnet references
- [ ] Build passes

**Testing:**
- [ ] E2E full flow passes
- [ ] All 11 steps documented
- [ ] Data persists after restart
- [ ] No errors in production logs

**Governance:**
- [ ] Pool funded
- [ ] Proposal created
- [ ] Process documented

**Documentation:**
- [ ] Architecture doc
- [ ] Contract flow doc
- [ ] Verifier guide
- [ ] Token/governance doc
- [ ] Deployment checklist
- [ ] Troubleshooting guide

**Operations:**
- [ ] Monitoring set up
- [ ] Error tracking (Sentry)
- [ ] Uptime monitoring
- [ ] Support procedures documented
- [ ] Incident response plan

---

## SUCCESS CRITERIA

System is **launch-ready** when:

✅ All database operations work  
✅ Admin routes protected on-chain  
✅ grantRole tested and working  
✅ Contracts deployed and verified  
✅ E2E test passes completely  
✅ Data persists across restarts  
✅ No security vulnerabilities  
✅ Documentation complete  
✅ Team comfortable with ops  

---

## POST-LAUNCH (Week 1-2)

After launch, monitor:
- [ ] API error rates
- [ ] Database query times
- [ ] Smart contract interactions
- [ ] User applications
- [ ] System stability

First issues to watch:
- Gas prices (might affect UX)
- Rate limits (adjust if needed)
- Database scalability
- RPC reliability

---

## FINAL NOTES

This plan is:
- ✅ Realistic (7 focused days)
- ✅ Complete (no gaps)
- ✅ Testable (clear acceptance criteria)
- ✅ Secure (admin checks, persistence)
- ✅ Professional (audit trail, docs)

**Key success factor:** Execute in order. Don't skip steps.

**Risk factors:** Mainnet surprises (gas, timing), contract issues, RPC reliability

**Contingency:** If contract issue found, delay 1-2 days for fix + retest

---

**Status:** Ready to Execute  
**Last Updated:** 2026-02-18  
**Next Review:** After Phase 9 (Feb 19)