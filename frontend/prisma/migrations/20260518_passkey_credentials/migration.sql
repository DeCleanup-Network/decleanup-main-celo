-- Passkey credentials for wallet unlock (WebAuthn)

CREATE TABLE IF NOT EXISTS "PasskeyCredential" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "credentialID" TEXT NOT NULL,
  "publicKey" TEXT NOT NULL,
  "counter" INTEGER NOT NULL DEFAULT 0,
  "transports" JSONB,
  "deviceType" TEXT,
  "backedUp" BOOLEAN,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PasskeyCredential_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasskeyCredential_credentialID_key" ON "PasskeyCredential"("credentialID");
CREATE INDEX IF NOT EXISTS "PasskeyCredential_userId_idx" ON "PasskeyCredential"("userId");

ALTER TABLE "PasskeyCredential"
  ADD CONSTRAINT "PasskeyCredential_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "PasskeyUnlockSecret" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "secret" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "PasskeyUnlockSecret_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "PasskeyUnlockSecret_userId_key" ON "PasskeyUnlockSecret"("userId");

ALTER TABLE "PasskeyUnlockSecret"
  ADD CONSTRAINT "PasskeyUnlockSecret_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS "WebAuthnChallenge" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "challenge" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "WebAuthnChallenge_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "WebAuthnChallenge_challenge_key" ON "WebAuthnChallenge"("challenge");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_userId_idx" ON "WebAuthnChallenge"("userId");
CREATE INDEX IF NOT EXISTS "WebAuthnChallenge_expiresAt_idx" ON "WebAuthnChallenge"("expiresAt");

ALTER TABLE "WebAuthnChallenge"
  ADD CONSTRAINT "WebAuthnChallenge_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE public."PasskeyCredential" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PasskeyCredential" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."PasskeyUnlockSecret" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PasskeyUnlockSecret" FORCE ROW LEVEL SECURITY;
ALTER TABLE public."WebAuthnChallenge" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebAuthnChallenge" FORCE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public."PasskeyCredential" FROM anon, authenticated;
REVOKE ALL ON TABLE public."PasskeyUnlockSecret" FROM anon, authenticated;
REVOKE ALL ON TABLE public."WebAuthnChallenge" FROM anon, authenticated;
