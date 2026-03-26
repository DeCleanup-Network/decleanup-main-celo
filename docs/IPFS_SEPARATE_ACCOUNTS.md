# IPFS Storage Separation - DeCleanup Network

## Overview

This guide explains how to store DeCleanup uploads in a completely separate Pinata account or folder, keeping them isolated from your other app's files.

## Option 1: Use Different Pinata Account (Recommended)

Use separate Pinata API keys for DeCleanup:

### Step 1: Create New Pinata Account
1. Go to https://pinata.cloud
2. Sign up with a different email (or use Pinata Teams)
3. Get new API keys from Dashboard → API Keys

### Step 2: Update Environment Variables

**Frontend `.env.local`:**
```bash
# DeCleanup Pinata Account (separate from your other app)
PINATA_API_KEY=your_decleanup_pinata_api_key
PINATA_SECRET_KEY=your_decleanup_pinata_secret_key

# Other app uses different keys
```

**VPS `/var/www/decleanup/frontend/.env.local`:**
```bash
PINATA_API_KEY=your_decleanup_pinata_api_key
PINATA_SECRET_KEY=your_decleanup_pinata_secret_key
```

### Result:
- DeCleanup uploads go to Account A
- Your other app uploads go to Account B
- Completely separate billing, storage, and management

---

## Option 2: Use Pinata Groups/Folders (Same Account)

Use Pinata's group feature to organize uploads in the same account.

### Step 1: Create a Group in Pinata
1. Go to Pinata Dashboard → Groups
2. Create a new group called "DeCleanup"
3. Note the group ID

### Step 2: Modify Upload Route

**File**: `frontend/src/app/api/ipfs/upload/route.ts`

Add group parameter:

```typescript
// After line 101, before uploading to Pinata
const pinataOptions = {
  cidVersion: 1,
  wrapWithDirectory: false,
  // Add group ID to organize uploads
  groupId: process.env.PINATA_GROUP_ID, // Add to .env.local
}
pinataFormData.append('pinataOptions', JSON.stringify(pinataOptions))
```

### Step 3: Update Environment Variables

```bash
# .env.local
PINATA_GROUP_ID=your_group_id_from_pinata_dashboard
```

### Result:
- Same account, organized in groups/folders
- Easy to filter in Pinata dashboard
- Separate billing if you upgrade to paid plan

---

## Option 3: Use Pinata Submarine Keys (Advanced)

Submarine keys let you create restricted API keys with specific access rules.

### Step 1: Create Submarine Key in Pinata
1. Go to Pinata Dashboard → API Keys
2. Create new Submarine key
3. Set restrictions (specific CIDs, time limits, etc.)

### Step 2: Use Different Keys for Different Apps

**DeCleanup `.env.local`:**
```bash
PINATA_API_KEY=submarine_key_for_decleanup
PINATA_SECRET_KEY=submarine_secret_for_decleanup
```

**Other App `.env.local`:**
```bash
PINATA_API_KEY=submarine_key_for_other_app
PINATA_SECRET_KEY=submarine_secret_for_other_app
```

### Result:
- Same main account
- Different keys for different apps
- Can set access restrictions per key

---

## Option 4: Use Different IPFS Service (Alternative)

Use a completely different IPFS provider for DeCleanup.

### Supported Services:
- **Pinata** (current)
- **NFT.Storage** (free, recommended for NFTs)
- **Web3.Storage** (free, by Protocol Labs)
- **Infura IPFS** (paid)
- **Filebase** (S3-compatible IPFS)

### To Switch Providers:

Modify `frontend/src/app/api/ipfs/upload/route.ts` to use different API:

```typescript
// For NFT.Storage
const response = await fetch('https://api.nft.storage/upload', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.NFT_STORAGE_API_KEY}`,
  },
  body: formData,
})
```

---

## Recommended Solution

**For complete separation**: Use **Option 1** (Different Pinata Account)

### Why:
- ✅ Complete isolation
- ✅ No code changes needed
- ✅ Just change environment variables
- ✅ Separate billing and quotas
- ✅ Easy to manage

### Implementation:

1. **Create new Pinata account** for DeCleanup
2. **Get new API keys** from new account
3. **Update `.env.local` files**:

```bash
# Local development: frontend/.env.local
PINATA_API_KEY=pk_abc123... # New account key
PINATA_SECRET_KEY=sk_xyz789... # New account secret

# VPS production: /var/www/decleanup/frontend/.env.local
PINATA_API_KEY=pk_abc123...
PINATA_SECRET_KEY=sk_xyz789...
```

4. **Restart the app**:
```bash
# Local
npm run dev

# VPS
pm2 restart decleanup
```

That's it! All DeCleanup uploads will now go to the new Pinata account.

---

## Environment Variables Reference

### Current Code Uses These Variables:

```typescript
// frontend/src/app/api/ipfs/upload/route.ts
const pinataApiKey = process.env.PINATA_API_KEY
const pinataSecretKey = process.env.PINATA_SECRET_KEY
```

### To Use Different Account:

Just change these values in `.env.local` to point to different Pinata account.

### File Locations:

- **Local Dev**: `frontend/.env.local`
- **VPS Production**: `/var/www/decleanup/frontend/.env.local`
- **Example**: `frontend/ENV_TEMPLATE.md`

---

## Testing

After changing API keys:

1. Submit a cleanup with photos
2. Check the new Pinata account dashboard
3. Verify uploads appear in the new account
4. Your other app should still use old account

---

**Quick Answer**: Change `PINATA_API_KEY` and `PINATA_SECRET_KEY` in `.env.local` to use a different Pinata account.
