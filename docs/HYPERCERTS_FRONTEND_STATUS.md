# Hypercerts Frontend Status

## Overview

You have **TWO** working Hypercert minting flows:

### 1. Quick Mint (Main Dashboard)
**Location**: `frontend/src/app/page.tsx`  
**Status**: ✅ Working  
**Features**:
- One-click mint from dashboard
- Shows eligibility status
- Uses PR #30 metadata generation
- Simulated mint (placeholder)

### 2. Custom Hypercert Page
**Location**: `frontend/src/app/create-hypercert/page.tsx`  
**Status**: ✅ Updated & integrated with PR #30  
**Features**:
- Upload custom logo image
- Upload custom banner image
- Eligibility check before minting
- Shows testing mode indicator (Sepolia Testnet)
- Step-by-step status (uploading → generating → minting)
- Full metadata generation from verified cleanups
- Images uploaded to IPFS

**Access**: Navigate to `http://localhost:3000/create-hypercert`

---

## What's Integrated

### From PR #30:
✅ `checkHypercertEligibility()` - Checks if user has enough cleanups/reports  
✅ `aggregateUserCleanups()` - Aggregates cleanup data  
✅ `buildHypercertMetadata()` - Generates full metadata with:
  - User address
  - Cleanup IDs and timestamps
  - Total cleanups, reports
  - Timeframe (start/end)
  - Issuer info
  - Optional narrative

### New Features in `/create-hypercert`:
✅ Wallet connection check  
✅ Real-time eligibility check  
✅ Testing mode indicator "(Sepolia Testnet)"  
✅ Disabled mint button if not eligible  
✅ Image upload (logo + banner) to IPFS  
✅ Status feedback during minting process  

---

## Current Metadata Structure

```json
{
  "version": "v1",
  "issuer": "DeCleanup Network",
  "user": "0x...",
  "impact": {
    "cleanups": [
      { "id": "1", "verifiedAt": 1705400000 },
      { "id": "2", "verifiedAt": 1705410000 }
    ],
    "summary": {
      "totalCleanups": 10,
      "totalReports": 8,
      "timeframeStart": 1705400000,
      "timeframeEnd": 1705500000
    }
  },
  "narrative": {
    "description": "Environmental cleanup impact certificate...",
    "locations": [],
    "wasteTypes": [],
    "challenges": "Testing phase implementation",
    "preventionIdeas": "Continued environmental education..."
  },
  "generatedAt": 1705500000
}
```

**Plus** uploaded images:
```json
{
  "logo": "QmLogoHashHere...",
  "banner": "QmBannerHashHere..."
}
```

---

## Testing Guide

### Prerequisites:
1. ✅ Connect wallet
2. ✅ Have at least 1 verified cleanup (Sepolia testnet)
3. ✅ Have at least 1 impact report

### Test Steps:

**Option A - Quick Mint (Dashboard)**:
1. Navigate to `http://localhost:3000`
2. Connect wallet
3. See "HYPERCERT" section if eligible
4. Click "Quick Mint" button
5. Check console for generated metadata

**Option B - Custom Hypercert Page**:
1. Navigate to `http://localhost:3000/create-hypercert`
2. See eligibility status at top
3. Upload a logo image
4. Upload a banner image
5. Click "Mint Hypercert"
6. Watch status messages (uploading → generating → minting)
7. See success message with tx hash

---

## What's Still Simulated

⚠️ **Minting**: Returns fake tx hash (`0xSIMULATED_MINT_...`)  
⚠️ **On-chain**: No actual Hypercerts contract call  
⚠️ **Images**: Uploaded to IPFS but not yet linked in metadata  
⚠️ **Rewards**: No `claimHypercertReward()` call after mint  

---

## Next Steps for Real Minting

1. **Integrate Hypercerts SDK**:
   - Use `HypercertClient.mintClaim()`
   - Pass metadata URI (after IPFS upload)
   - Return real transaction hash

2. **Link Images in Metadata**:
   - Add `image` and `logo` fields to metadata
   - Upload full metadata JSON to IPFS
   - Use IPFS hash for on-chain mint

3. **Reward Claim**:
   - Call `claimHypercertReward()` after successful mint
   - Add 10 $DCU to user balance

4. **Error Handling**:
   - Handle wallet rejection
   - Handle IPFS upload failures
   - Handle contract errors

---

## File Summary

### Core Logic:
- `frontend/src/lib/blockchain/hypercerts-minting.ts` - Main mint function with metadata
- `frontend/src/lib/blockchain/hypercerts/eligibility.ts` - Eligibility checker
- `frontend/src/lib/blockchain/hypercerts/metadata.ts` - Metadata builder
- `frontend/src/lib/blockchain/hypercerts/aggregation.ts` - Cleanup aggregation

### UI Pages:
- `frontend/src/app/page.tsx` - Main dashboard with "Quick Mint" button
- `frontend/src/app/create-hypercert/page.tsx` - Custom Hypercert creation page

---

## Commit Status

**Not committed to main**:
- ❌ `frontend/src/app/create-hypercert/page.tsx`
- ❌ `frontend/src/lib/gemini.ts` (stub)
- ❌ Various docs and scripts

**Committed to main (PR #30)**:
- ✅ All `frontend/src/lib/blockchain/hypercerts/*` modules
- ✅ Updated `frontend/src/app/page.tsx` (eligibility integration)
- ✅ Updated `frontend/src/lib/blockchain/hypercerts-minting.ts` (metadata)

---

**Ready to test?** Start here: `http://localhost:3000/create-hypercert`

