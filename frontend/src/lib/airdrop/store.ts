/**
 * Server-only durable store for airdrop claim state.
 *
 * Primary: Supabase `airdrop_issued_store` (same project as Prisma / cdcu_issued_store).
 * Fallback: local JSON at `AIRDROP_ISSUED_STORE_PATH` or `./data/airdrop-issued.json`.
 */

import 'server-only'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const CLAIMED_PREFIX = 'claimed_'
const PENDING_PREFIX = 'pending_'

let supabaseClient: SupabaseClient | null = null
let supabaseChecked = false

function getSupabase(): SupabaseClient | null {
  if (supabaseChecked) return supabaseClient
  supabaseChecked = true
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim()
  const key = (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    ''
  ).trim()
  if (!url || !key) return null
  supabaseClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
  return supabaseClient
}

export function isAirdropSupabaseBacked(): boolean {
  return getSupabase() !== null
}

const DEFAULT_FILE_PATH = path.join(process.cwd(), 'data', 'airdrop-issued.json')

function fileStorePath(): string {
  return process.env.AIRDROP_ISSUED_STORE_PATH || DEFAULT_FILE_PATH
}

function loadFileStore(): Record<string, string> {
  try {
    const fs = require('fs') as typeof import('fs')
    const p = fileStorePath()
    if (!fs.existsSync(p)) return {}
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as Record<string, string>
  } catch {
    return {}
  }
}

function saveFileStore(store: Record<string, string>): void {
  try {
    const fs = require('fs') as typeof import('fs')
    const p = fileStorePath()
    const dir = path.dirname(p)
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(p, JSON.stringify(store, null, 2))
  } catch (e) {
    console.error('[airdrop store] file save failed:', e)
  }
}

function claimedKey(recipient: string): string {
  return `${CLAIMED_PREFIX}${recipient.toLowerCase()}`
}

function pendingKey(recipient: string): string {
  return `${PENDING_PREFIX}${recipient.toLowerCase()}`
}

async function getValue(key: string): Promise<string | null> {
  const client = getSupabase()
  if (!client) {
    const store = loadFileStore()
    return store[key] ?? null
  }
  const { data, error } = await client
    .from('airdrop_issued_store')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.error('[airdrop store] read error:', error)
    return null
  }
  return (data?.value as string | undefined) ?? null
}

async function setValue(key: string, value: string | null): Promise<void> {
  const client = getSupabase()
  if (!client) {
    const store = loadFileStore()
    if (value == null) delete store[key]
    else store[key] = value
    saveFileStore(store)
    return
  }
  if (value == null) {
    const { error } = await client.from('airdrop_issued_store').delete().eq('key', key)
    if (error) console.error('[airdrop store] delete error:', error)
    return
  }
  const { error } = await client
    .from('airdrop_issued_store')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) console.error('[airdrop store] upsert error:', error)
}

export async function hasAirdropClaimed(recipient: string): Promise<boolean> {
  return (await getValue(claimedKey(recipient))) === '1'
}

export async function getAirdropPending(recipient: string): Promise<bigint> {
  const v = await getValue(pendingKey(recipient))
  try {
    return BigInt(v ?? '0')
  } catch {
    return 0n
  }
}

export async function setAirdropPending(recipient: string, amountWei: bigint): Promise<void> {
  await setValue(pendingKey(recipient), amountWei === 0n ? null : amountWei.toString())
}

export async function markAirdropClaimed(recipient: string): Promise<void> {
  await setValue(claimedKey(recipient), '1')
  await setAirdropPending(recipient, 0n)
}

export async function clearAirdropPending(recipient: string): Promise<void> {
  await setAirdropPending(recipient, 0n)
}
