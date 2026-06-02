# Auth / email login troubleshooting

## Resend setup (recommended — HTTP API)

The app sends magic links with **Resend’s API** when `RESEND_API_KEY` is set. You do **not** need `EMAIL_SERVER` unless you prefer SMTP.

### 1. Create a Resend account

1. Go to [https://resend.com](https://resend.com) and sign up.
2. Open **API Keys** → **Create API Key** (Sending access is enough).
3. Copy the key (`re_…`). You only see it once.

### 2. Local dev (`.env.local` in `frontend/`)

```bash
RESEND_API_KEY=re_your_key_here
EMAIL_FROM=DeCleanup <onboarding@resend.dev>
AUTH_URL=http://localhost:3000
AUTH_SECRET=   # openssl rand -base64 32
DATABASE_URL=postgresql://...
DIRECT_URL=postgresql://...
```

Restart `npm run dev` after saving.

**Test sender rule:** With `onboarding@resend.dev`, Resend only delivers to the **email address on your Resend account**. For testing, type that exact email on the login form—not a random Gmail unless you verify a domain.

### 3. Vercel Production

In **Project → Settings → Environment Variables** (Production):

| Variable | Example |
|----------|---------|
| `RESEND_API_KEY` | `re_…` |
| `EMAIL_FROM` | `DeCleanup <onboarding@resend.dev>` (test) or `DeCleanup <noreply@dapp.decleanup.net>` (after domain verify) |
| `AUTH_URL` | `https://dapp.decleanup.net` |
| `AUTH_SECRET` | same as local or new random |
| `DATABASE_URL` | Supabase **Session pooler** `postgresql://…` |
| `DIRECT_URL` | Supabase **Direct** `postgresql://…` |

**Redeploy** after any env change (Deployments → … → Redeploy).

### 4. Verify it works

```bash
cd frontend && npm run db:check
```

Should print `OK: RESEND_API_KEY is set`.

On login, use **Continue with Email**. Success → redirect/query `?email=sent` and mail in inbox (check spam).

### 5. Production mail to any user

1. Resend → **Domains** → add `decleanup.net` (or your app domain).
2. Add the DNS records Resend shows (SPF/DKIM).
3. Wait until status is **Verified**.
4. Set `EMAIL_FROM=DeCleanup <noreply@dapp.decleanup.net>` (must use that domain).
5. Redeploy Vercel.

---

## Error messages on the login form

| Error / symptom | Likely cause | Fix |
|-----------------|--------------|-----|
| No “Continue with Email” | `RESEND_API_KEY` and `EMAIL_SERVER` both unset | Add `RESEND_API_KEY` on Vercel, redeploy |
| `Configuration` | Postgres / Auth.js env | `DATABASE_URL`, `DIRECT_URL`, `AUTH_SECRET`, run `npm run db:check` |
| `EmailSignin` | Resend rejected send | Wrong API key; or `onboarding@resend.dev` + recipient not your Resend account email; or unverified `EMAIL_FROM` domain |
| Link opens localhost on phone | `AUTH_URL` wrong on Production | Set `AUTH_URL=https://dapp.decleanup.net`, redeploy |
| Mail never arrives | Test sender restriction | Use Resend account email, or verify domain |

---

## Legacy: SMTP (`EMAIL_SERVER`)

Only used if **`RESEND_API_KEY` is not set**:

```bash
EMAIL_SERVER=smtp://resend:re_YOUR_API_KEY@smtp.resend.com:587
EMAIL_FROM=DeCleanup <onboarding@resend.dev>
```

If the API key has special characters, URL-encode them in the SMTP URL. Prefer `RESEND_API_KEY` instead.

---

## `relation "User" already exists` (42P07)

Your database already has Auth.js tables. Do **not** re-run full schema blindly.

```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('User', 'Account', 'Session', 'VerificationToken', 'UserWallet');
```

Email magic links need `VerificationToken`.

---

## Until email works

Use **Continue with Google** on the login page.
