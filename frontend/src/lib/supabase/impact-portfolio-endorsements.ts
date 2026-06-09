import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { PortfolioEndorsement } from '@/lib/impact/portfolio-endorsements'

type EndorsementRow = {
  id: string
  portfolio_address: string
  endorser_address: string
  endorser_name: string
  endorser_org: string
  statement: string
  signature: string
  created_at: string
}

let supabaseServerClient: ReturnType<typeof createClient<Database>> | null = null

function getSupabase() {
  if (supabaseServerClient) return supabaseServerClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase server credentials for portfolio endorsements. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  supabaseServerClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabaseServerClient
}

function rowToEndorsement(row: EndorsementRow): PortfolioEndorsement {
  return {
    id: row.id,
    portfolioAddress: row.portfolio_address,
    endorserAddress: row.endorser_address,
    endorserName: row.endorser_name,
    endorserOrg: row.endorser_org,
    statement: row.statement,
    createdAt: row.created_at,
  }
}

export async function listPortfolioEndorsements(portfolioAddress: string): Promise<PortfolioEndorsement[]> {
  const { data, error } = await getSupabase()
    .from('impact_portfolio_endorsements' as 'impact_portfolios')
    .select('id, portfolio_address, endorser_address, endorser_name, endorser_org, statement, signature, created_at')
    .eq('portfolio_address', portfolioAddress.toLowerCase())
    .order('created_at', { ascending: false })

  if (error) {
    if (error.message.includes('impact_portfolio_endorsements')) return []
    throw new Error(`Failed to list endorsements: ${error.message}`)
  }

  return ((data as unknown as EndorsementRow[]) ?? []).map(rowToEndorsement)
}

export async function insertPortfolioEndorsement(params: {
  portfolioAddress: string
  endorserAddress: string
  endorserName: string
  endorserOrg: string
  statement: string
  signature: string
}): Promise<PortfolioEndorsement> {
  const { data, error } = await getSupabase()
    .from('impact_portfolio_endorsements' as 'impact_portfolios')
    .insert({
      portfolio_address: params.portfolioAddress.toLowerCase(),
      endorser_address: params.endorserAddress.toLowerCase(),
      endorser_name: params.endorserName,
      endorser_org: params.endorserOrg,
      statement: params.statement,
      signature: params.signature,
    } as never)
    .select('id, portfolio_address, endorser_address, endorser_name, endorser_org, statement, signature, created_at')
    .single()

  if (error) throw new Error(`Failed to save endorsement: ${error.message}`)
  return rowToEndorsement(data as unknown as EndorsementRow)
}
