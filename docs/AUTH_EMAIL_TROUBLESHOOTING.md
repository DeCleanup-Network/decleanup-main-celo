# Auth / email login troubleshooting

## `relation "User" already exists` (42P07)

**This is normal.** Your database already has the Auth.js tables. Do **not** run `supabase-full-schema.sql` again.

To apply only missing pieces safely, use `frontend/prisma/supabase-auth-tables.sql` (`CREATE TABLE IF NOT EXISTS`).

### Check tables in Supabase SQL Editor

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('User', 'Account', 'Session', 'VerificationToken', 'UserWallet')
ORDER BY table_name;
```

Email magic links need `VerificationToken`.

---

## Email login: `Configuration` on Vercel

`EMAIL_SERVER` and `EMAIL_FROM` are required but not always sufficient. `Configuration` often means **Auth.js could not use Postgres** when creating the magic link.

| Variable | Must be |
|----------|---------|
| `AUTH_SECRET` | Set |
| `DATABASE_URL` | `postgresql://...` (not the Supabase `https://` API URL) |
| `DIRECT_URL` | Prisma direct connection |
| `EMAIL_SERVER` | e.g. `smtp://resend:re_KEY@smtp.resend.com:587` |
| `EMAIL_FROM` | Verified sender |

Redeploy after env changes. With Resend `onboarding@resend.dev`, mail may only reach your Resend account email until you verify a domain.

```bash
cd frontend && npm run db:check
```

Check Vercel function logs on `/api/auth/*` after a failed sign-in.

Until email works: use **Continue with Google** (`docs/AIRDROP_USER_INSTRUCTIONS.md`).
