import 'server-only'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let client: SupabaseClient | null = null

function getSupabase(): SupabaseClient | null {
  if (client) return client
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim()
  if (!url || !key) return null
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return client
}

/** Returns true if this submission was already notified (skip send). */
export async function wasSubmissionTelegramNotified(submissionId: string): Promise<boolean> {
  const sb = getSupabase()
  if (!sb) return false
  const { data, error } = await sb
    .from('telegram_submission_notifications')
    .select('submission_id')
    .eq('submission_id', submissionId)
    .maybeSingle()
  if (error) {
    console.warn('[telegram-notification-log] read failed:', error.message)
    return false
  }
  return Boolean(data?.submission_id)
}

/** Record after a successful Telegram send. Idempotent via primary key. */
export async function markSubmissionTelegramNotified(
  submissionId: string,
  txHash?: string
): Promise<void> {
  const sb = getSupabase()
  if (!sb) return
  const { error } = await sb.from('telegram_submission_notifications').upsert(
    {
      submission_id: submissionId,
      tx_hash: txHash ?? null,
    },
    { onConflict: 'submission_id' }
  )
  if (error) {
    console.warn('[telegram-notification-log] upsert failed:', error.message)
  }
}
