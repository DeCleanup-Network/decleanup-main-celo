/**
 * Supabase Client Configuration
 * Lazy initialization to avoid build-time errors
 */

import { createClient } from '@supabase/supabase-js'

let supabaseClient: any = null

export function getSupabase() {
  if (supabaseClient) return supabaseClient

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!url || !key) {
    throw new Error('Missing Supabase environment variables')
  }

  supabaseClient = createClient(url, key)
  return supabaseClient
}

// Export as object that lazy-loads
export const supabase = {
  get from() {
    return getSupabase().from.bind(getSupabase())
  },
} as any
