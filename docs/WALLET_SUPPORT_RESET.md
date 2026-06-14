# Wallet support reset (lost passkey, no backup)

For **DeCleanup team** when a user emails **support@decleanup.net** and cannot unlock their embedded smart wallet.

## What this does

- Deletes **server-side** `UserWallet` + passkey rows for that login.
- User **keeps** Google/email sign-in.
- On next visit they **create a new wallet passkey** → **new smart account address**.
- **Old onchain address is not recovered** (cleanups, DCU, impact portfolio stay on the old address).

## Before you reset

1. Confirm request came from the **sign-in email** (same as `User.email` in DB).
2. Confirm they **do not** have access on another signed-in device where they still remember the passkey.
3. Note the **old smart account address** for support records.

## Option A — Script (recommended)

From `frontend/` with production `DATABASE_URL` in `.env.local`:

```bash
# List all wallets in DB (team lookup)
npm run support:wallet-reset -- --list

# Preview (dry run)
node scripts/reset-user-wallet.mjs --smart-account 0x7cd1a995842c32d557a09c063e6f13c0c99288f9

# Or by email
node scripts/reset-user-wallet.mjs --email user@example.com

# Execute reset
node scripts/reset-user-wallet.mjs --smart-account 0x7cd1a995842c32d557a09c063e6f13c0c99288f9 --confirm
```

## Option B — Supabase SQL Editor

```sql
-- 1) Find user (replace address)
SELECT w."userId", u.email, w.address, w."smartAccountAddress"
FROM "UserWallet" w
JOIN "User" u ON u.id = w."userId"
WHERE lower(w."smartAccountAddress") = lower('0x7cd1a995842c32d557a09c063e6f13c0c99288f9');

-- 2) Delete (replace USER_ID from step 1)
BEGIN;
DELETE FROM "WebAuthnChallenge" WHERE "userId" = 'USER_ID';
DELETE FROM "PasskeyCredential" WHERE "userId" = 'USER_ID';
DELETE FROM "PasskeyUnlockSecret" WHERE "userId" = 'USER_ID';
DELETE FROM "UserWallet" WHERE "userId" = 'USER_ID';
COMMIT;
```

## After reset — reply to user

1. Sign out everywhere, sign in again at https://dapp.decleanup.net
2. Complete **new wallet passkey** setup in Account settings
3. **New smart account address** will differ from the old one

## npm shortcut

```bash
cd frontend
npm run support:wallet-reset -- --smart-account 0x... --confirm
```
