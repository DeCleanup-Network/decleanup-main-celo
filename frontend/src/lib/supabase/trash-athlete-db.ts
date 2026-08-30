import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'crypto'
import type { Database } from '@/lib/supabase/database.types'
import type {
  TrashAthleteChallenge,
  TrashAthleteLevelGrantStatus,
  TrashAthleteStatus,
} from '@/lib/trash-athlete/types'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'

type Row = Database['public']['Tables']['trash_athlete_challenges']['Row']

let client: ReturnType<typeof createClient<Database>> | null = null

function getSupabase() {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) {
    throw new Error(
      'Missing Supabase server credentials for trash athlete challenges. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.'
    )
  }
  client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

function rowToChallenge(row: Row): TrashAthleteChallenge {
  return {
    id: row.id,
    userId: row.user_id,
    walletAddress: row.wallet_address,
    email: row.email,
    username: row.username,
    socialProfileUrl: row.social_profile_url,
    notes: row.notes,
    status: row.status as TrashAthleteStatus,
    submittedAt: Number(row.submitted_at),
    reviewedAt: row.reviewed_at != null ? Number(row.reviewed_at) : null,
    reviewedBy: row.reviewed_by,
    rejectionReason: row.rejection_reason,
    bonusCdcuAmount: String(row.bonus_cdcu_amount),
    bonusCdcuClaimed: Boolean(row.bonus_cdcu_claimed),
    bonusCdcuClaimTx: row.bonus_cdcu_claim_tx,
    levelTarget: Number(row.level_target),
    dcuPointsAmount: Number(row.dcu_points_amount),
    levelGrantStatus: row.level_grant_status as TrashAthleteLevelGrantStatus,
  }
}

export function newTrashAthleteChallengeId(): string {
  return `ta_${Date.now().toString(36)}_${randomBytes(4).toString('hex')}`
}

export async function insertTrashAthleteChallenge(params: {
  id?: string
  userId?: string | null
  walletAddress: string
  email?: string | null
  username: string
  socialProfileUrl: string
  notes?: string | null
}): Promise<TrashAthleteChallenge> {
  const id = params.id ?? newTrashAthleteChallengeId()
  const insert = {
    id,
    user_id: params.userId ?? null,
    wallet_address: params.walletAddress.toLowerCase(),
    email: params.email ?? null,
    username: params.username.trim(),
    social_profile_url: params.socialProfileUrl.trim(),
    notes: params.notes?.trim() || null,
    status: 'PENDING' as const,
    submitted_at: Date.now(),
    bonus_cdcu_amount: Number(TRASH_ATHLETE_BONUS_CDCU),
    dcu_points_amount: TRASH_ATHLETE_DCU_POINTS,
    level_target: TRASH_ATHLETE_TARGET_LEVEL,
    level_grant_status: 'pending' as const,
  }

  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .insert([insert] as never)
    .select()
    .single()

  if (error) throw new Error(`Failed to create trash athlete challenge: ${error.message}`)
  return rowToChallenge(data as Row)
}

export async function listTrashAthleteByStatus(status: TrashAthleteStatus): Promise<TrashAthleteChallenge[]> {
  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .select('*')
    .eq('status', status)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`Failed to list trash athlete challenges: ${error.message}`)
  return ((data ?? []) as Row[]).map(rowToChallenge)
}

export async function listTrashAthleteForWallet(walletAddress: string): Promise<TrashAthleteChallenge[]> {
  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`Failed to list trash athlete challenges: ${error.message}`)
  return ((data ?? []) as Row[]).map(rowToChallenge)
}

export async function listTrashAthleteForUserId(userId: string): Promise<TrashAthleteChallenge[]> {
  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })

  if (error) throw new Error(`Failed to list trash athlete challenges: ${error.message}`)
  return ((data ?? []) as Row[]).map(rowToChallenge)
}

export async function getTrashAthleteById(id: string): Promise<TrashAthleteChallenge | null> {
  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`Failed to load trash athlete challenge: ${error.message}`)
  return data ? rowToChallenge(data as Row) : null
}

export async function hasOpenTrashAthleteForWallet(walletAddress: string): Promise<boolean> {
  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .select('id')
    .eq('wallet_address', walletAddress.toLowerCase())
    .eq('status', 'PENDING')
    .limit(1)

  if (error) throw new Error(`Failed to check open trash athlete challenge: ${error.message}`)
  return (data?.length ?? 0) > 0
}

export async function updateTrashAthleteReview(params: {
  id: string
  status: 'APPROVED' | 'REJECTED'
  reviewedBy: string
  rejectionReason?: string | null
}): Promise<TrashAthleteChallenge> {
  const update = {
    status: params.status,
    reviewed_at: Date.now(),
    reviewed_by: params.reviewedBy.toLowerCase(),
    rejection_reason: params.status === 'REJECTED' ? params.rejectionReason?.trim() || null : null,
  }

  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .update(update as never)
    .eq('id', params.id)
    .eq('status', 'PENDING')
    .select()
    .maybeSingle()

  if (error) throw new Error(`Failed to update trash athlete challenge: ${error.message}`)
  if (!data) throw new Error('Challenge not found or already reviewed')
  return rowToChallenge(data as Row)
}

export async function markTrashAthleteBonusClaimed(params: {
  id: string
  txHash: string
}): Promise<void> {
  const { error } = await getSupabase()
    .from('trash_athlete_challenges')
    .update({
      bonus_cdcu_claimed: true,
      bonus_cdcu_claim_tx: params.txHash,
    } as never)
    .eq('id', params.id)

  if (error) throw new Error(`Failed to mark trash athlete bonus claimed: ${error.message}`)
}

export async function findClaimableTrashAthleteBonus(
  walletAddress: string
): Promise<TrashAthleteChallenge | null> {
  const { data, error } = await getSupabase()
    .from('trash_athlete_challenges')
    .select('*')
    .eq('wallet_address', walletAddress.toLowerCase())
    .eq('status', 'APPROVED')
    .eq('bonus_cdcu_claimed', false)
    .order('reviewed_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw new Error(`Failed to find claimable trash athlete bonus: ${error.message}`)
  return data ? rowToChallenge(data as Row) : null
}
