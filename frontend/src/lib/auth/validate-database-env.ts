import 'server-only'

const POSTGRES_URL_PATTERN = /^postgres(ql)?:\/\//i

/** Warn when Prisma cannot connect (Auth.js adapter → login ?error=Configuration). */
export function warnIfDatabaseMisconfigured(): void {
  if (process.env.NODE_ENV === 'production') return

  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    console.warn(
      '[auth] DATABASE_URL is missing. Google sign-in needs PostgreSQL for Auth.js (Prisma). ' +
        'See .env.aa.example — use Supabase → Project Settings → Database → Connection string (URI).'
    )
    return
  }

  if (!POSTGRES_URL_PATTERN.test(url)) {
    console.warn(
      '[auth] DATABASE_URL must be a PostgreSQL URI (postgresql://...), not an https:// Supabase API URL. ' +
        'Copy the database connection string from Supabase Dashboard → Database → Connect.'
    )
    return
  }

  if (!/sslmode=/i.test(url)) {
    console.warn(
      '[auth] Supabase usually needs ?sslmode=require on DATABASE_URL. ' +
        'Run: npm run db:check — then npm run db:push (or prisma/supabase-auth-tables.sql in SQL Editor).'
    )
  }
}
