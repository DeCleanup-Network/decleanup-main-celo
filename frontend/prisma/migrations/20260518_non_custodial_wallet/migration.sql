-- Non-custodial wallet schema: opaque client-encrypted blob only.
-- Backup your database before running.

ALTER TABLE "UserWallet" DROP COLUMN IF EXISTS "encryptedPrivateKey";
ALTER TABLE "UserWallet" DROP COLUMN IF EXISTS "iv";
ALTER TABLE "UserWallet" DROP COLUMN IF EXISTS "authTag";

ALTER TABLE "UserWallet" RENAME COLUMN "eoaAddress" TO "address";

ALTER TABLE "UserWallet" ADD COLUMN IF NOT EXISTS "encryptedBlob" JSONB;
ALTER TABLE "UserWallet" ADD COLUMN IF NOT EXISTS "walletVersion" INTEGER NOT NULL DEFAULT 2;

-- If encryptedBlob is new, backfill from legacy columns before dropping them (run migrate-custodial-wallets.ts instead for key export).

ALTER TABLE "UserWallet" ALTER COLUMN "smartAccountAddress" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "UserWallet_address_key" ON "UserWallet"("address");
