import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  pgPool: pg.Pool | undefined
}

function shouldUsePgDriver(url: string | undefined): boolean {
  if (!url) return false
  if (process.env.PRISMA_USE_PG_DRIVER === '0') return false
  // Supabase + many hosted Postgres: Node pg + SSL works when Prisma engine hits P1001
  return (
    process.env.PRISMA_USE_PG_DRIVER === '1' ||
    url.includes('supabase.co') ||
    url.includes('pooler.supabase.com')
  )
}

function createPrismaClient(): PrismaClient {
  const url = process.env.DATABASE_URL
  const log =
    process.env.NODE_ENV === 'development' ? (['error', 'warn'] as const) : (['error'] as const)

  if (url && shouldUsePgDriver(url)) {
    const pgUrl = new URL(url)
    pgUrl.searchParams.delete('sslmode')
    const pool =
      globalForPrisma.pgPool ??
      new pg.Pool({
        connectionString: pgUrl.toString(),
        max: 10,
        ssl: { rejectUnauthorized: false },
      })
    if (process.env.NODE_ENV !== 'production') globalForPrisma.pgPool = pool
    const adapter = new PrismaPg(pool)
    return new PrismaClient({ adapter, log: [...log] })
  }

  return new PrismaClient({ log: [...log] })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
