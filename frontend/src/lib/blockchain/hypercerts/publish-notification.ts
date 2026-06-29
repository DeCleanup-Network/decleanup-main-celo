const STORAGE_KEY = 'decleanup_hypercert_publish_notified'

type NotifyStore = Record<string, string[]>

function readStore(): NotifyStore {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as NotifyStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: NotifyStore): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
  } catch {
    // ignore quota / private mode
  }
}

function normalizeAddress(address: string): string {
  return address.trim().toLowerCase()
}

/** Request IDs for which the user already saw the "published" modal. */
export function getNotifiedHypercertRequestIds(address: string): Set<string> {
  const key = normalizeAddress(address)
  const ids = readStore()[key] ?? []
  return new Set(ids)
}

export function markHypercertPublishNotified(address: string, requestId: string): void {
  const key = normalizeAddress(address)
  const store = readStore()
  const existing = new Set(store[key] ?? [])
  existing.add(requestId)
  store[key] = Array.from(existing)
  writeStore(store)
}
