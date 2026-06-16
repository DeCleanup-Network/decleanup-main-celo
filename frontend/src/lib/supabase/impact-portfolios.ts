import 'server-only'
import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'
import type { EditableProfile } from '@/lib/impact/portfolio-profile'

type ImpactPortfolioRow = Database['public']['Tables']['impact_portfolios']['Row']
type ImpactPortfolioInsert = Database['public']['Tables']['impact_portfolios']['Insert']

let supabaseServerClient: ReturnType<typeof createClient<Database>> | null = null

function getSupabase() {
  if (supabaseServerClient) return supabaseServerClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY

  if (!url || !key) {
    throw new Error(
      'Missing Supabase server credentials for impact portfolios. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }

  supabaseServerClient = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabaseServerClient
}

function rowToProfile(row: ImpactPortfolioRow): EditableProfile {
  const extended = row as ImpactPortfolioRow & {
    legal_name?: string
    impact_context?: string
    additionality_statement?: string
  }
  return {
    displayName: row.display_name,
    legalName: extended.legal_name ?? '',
    bio: row.bio,
    locationLabel: row.location_label,
    locationCoords: row.location_coords,
    showPreciseLocation: row.show_precise_location,
    impactContext: extended.impact_context ?? '',
    additionalityStatement: extended.additionality_statement ?? '',
    creatorName: row.creator_name,
    creatorRole: row.creator_role,
    projects: row.projects,
    openTo: row.open_to,
    farcaster: row.farcaster_url,
    twitter: row.twitter_url,
    dapp: row.dapp_url,
  }
}

export async function getImpactPortfolioProfile(address: string): Promise<EditableProfile | null> {
  const { data, error } = await getSupabase()
    .from('impact_portfolios')
    .select('*')
    .eq('address', address.toLowerCase())
    .single()

  if (error?.code === 'PGRST116') return null
  if (error) throw new Error(`Failed to fetch impact portfolio profile: ${error.message}`)
  return rowToProfile(data as ImpactPortfolioRow)
}

/** EOA-first lookup with optional legacy smart-account row fallback. */
export async function getImpactPortfolioProfileResolved(
  eoaAddress: string,
  legacySmartAccount?: string | null
): Promise<EditableProfile | null> {
  const primary = await getImpactPortfolioProfile(eoaAddress)
  if (primary) return primary
  if (
    legacySmartAccount &&
    legacySmartAccount.toLowerCase() !== eoaAddress.toLowerCase()
  ) {
    return getImpactPortfolioProfile(legacySmartAccount)
  }
  return null
}

export async function upsertImpactPortfolioProfile(address: string, profile: EditableProfile): Promise<void> {
  const insertData: ImpactPortfolioInsert & {
    legal_name?: string
    impact_context?: string
    additionality_statement?: string
  } = {
    address: address.toLowerCase(),
    display_name: profile.displayName,
    legal_name: profile.legalName,
    bio: profile.bio,
    location_label: profile.locationLabel,
    location_coords: profile.locationCoords,
    show_precise_location: profile.showPreciseLocation,
    impact_context: profile.impactContext,
    additionality_statement: profile.additionalityStatement,
    creator_name: profile.creatorName,
    creator_role: profile.creatorRole,
    projects: profile.projects,
    open_to: profile.openTo,
    farcaster_url: profile.farcaster,
    twitter_url: profile.twitter,
    dapp_url: profile.dapp,
  }

  const { error } = await getSupabase()
    .from('impact_portfolios')
    .upsert(insertData, { onConflict: 'address' })

  if (error) throw new Error(`Failed to save impact portfolio profile: ${error.message}`)
}
