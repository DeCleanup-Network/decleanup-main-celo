/**
 * Server-only durable store for $cDCU claim accounting.
 *
 * Primary backend: Supabase table `cdcu_issued_store` (key/value rows).
 * Fallback: local JSON file at `CLAIM_VAULT_ISSUED_STORE_PATH` or `./data/cdcu-issued.json`.
 *
 * Vercel and other serverless hosts do not persist a writable filesystem between
 * function invocations, so Supabase is required there. Locally, when Supabase env
 * vars are not configured, the file store keeps the dev experience working.
 */

import 'server-only'
import path from 'path'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const MILESTONES_SUFFIX = ':milestones'
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

/** True when Supabase is the active backend (production / staging). */
export function isSupabaseBacked(): boolean {
  return getSupabase() !== null
}

function issuedKey(recipient: string): string {
  return recipient.toLowerCase()
}
function milestonesKey(recipient: string): string {
  return `${recipient.toLowerCase()}${MILESTONES_SUFFIX}`
}
function pendingKey(recipient: string): string {
  return `${PENDING_PREFIX}${recipient.toLowerCase()}`
}

// ---------------------------------------------------------------------------
// Local-file fallback (dev only — Vercel ephemeral filesystems will lose data)
// ---------------------------------------------------------------------------

const DEFAULT_FILE_PATH = path.join(process.cwd(), 'data', 'cdcu-issued.json')

function fileStorePath(): string {
  return process.env.CLAIM_VAULT_ISSUED_STORE_PATH || DEFAULT_FILE_PATH
}

function loadFileStore(): Record<string, string> {
  try {
    // Avoid bundling `fs` for the edge runtime.
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
    console.error('[cdcu issued-store] file save failed:', e)
  }
}

// ---------------------------------------------------------------------------
// Single key/value primitives
// ---------------------------------------------------------------------------

async function getValue(key: string): Promise<string | null> {
  const client = getSupabase()
  if (!client) {
    const store = loadFileStore()
    return store[key] ?? null
  }
  const { data, error } = await client
    .from('cdcu_issued_store')
    .select('value')
    .eq('key', key)
    .maybeSingle()
  if (error && error.code !== 'PGRST116') {
    console.error('[cdcu issued-store] read error:', error)
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
    const { error } = await client.from('cdcu_issued_store').delete().eq('key', key)
    if (error) console.error('[cdcu issued-store] delete error:', error)
    return
  }
  const { error } = await client
    .from('cdcu_issued_store')
    .upsert({ key, value }, { onConflict: 'key' })
  if (error) console.error('[cdcu issued-store] upsert error:', error)
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Total $cDCU (wei) already issued to `recipient`. */
export async function getIssuedWei(recipient: string): Promise<bigint> {
  const v = await getValue(issuedKey(recipient))
  try {
    return BigInt(v ?? '0')
  } catch {
    return 0n
  }
}

/** Pending $cDCU (wei) signed but not yet confirmed onchain. */
export async function getPendingWei(recipient: string): Promise<bigint> {
  const v = await getValue(pendingKey(recipient))
  try {
    return BigInt(v ?? '0')
  } catch {
    return 0n
  }
}

/** Persist the pending amount; pass 0n to clear. */
export async function setPendingWei(recipient: string, amountWei: bigint): Promise<void> {
  await setValue(pendingKey(recipient), amountWei === 0n ? null : amountWei.toString())
}

/** Number of 50-DCU tranches the user has already fully claimed. Returns `null` if not yet persisted. */
export async function getStoredMilestones(recipient: string): Promise<number | null> {
  const v = await getValue(milestonesKey(recipient))
  if (v == null || v === '') return null
  const n = parseInt(v, 10)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Persist milestones count. */
export async function setMilestones(recipient: string, count: number): Promise<void> {
  await setValue(milestonesKey(recipient), String(Math.max(0, Math.floor(count))))
}

/**
 * Atomically record an onchain claim:
 *   issued += amountWei
 *   milestones += 1
 *   pending  = 0
 *
 * Not actually transactional — Supabase JS client doesn't expose multi-row tx.
 * Per-recipient races are mitigated by the `pending != 0` guard upstream.
 */
export async function recordIssued(recipient: string, amountWei: bigint): Promise<void> {
  const cur = await getIssuedWei(recipient)
  await setValue(issuedKey(recipient), (cur + amountWei).toString())
  const ms = (await getStoredMilestones(recipient)) ?? 0
  await setMilestones(recipient, ms + 1)
  await setPendingWei(recipient, 0n)
}

/** Drop the pending signature so the user can request a new one. */
export async function clearPending(recipient: string): Promise<void> {
  await setPendingWei(recipient, 0n)
}

/** Admin "unlock": forget issued + milestones + pending for a recipient. */
export async function resetIssuedAndPending(recipient: string): Promise<void> {
  await setValue(issuedKey(recipient), null)
  await setValue(milestonesKey(recipient), null)
  await setPendingWei(recipient, 0n)
}
