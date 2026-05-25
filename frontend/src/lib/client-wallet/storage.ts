'use client'

import type { LocalWalletRecord } from '@/lib/client-wallet/types'

const IDB_NAME = 'decleanup-aa-wallets'
const IDB_STORE = 'wallets'
const LS_PREFIX = 'decleanup-aa-wallet:'

function lsKey(userId: string) {
  return `${LS_PREFIX}${userId}`
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB open failed'))
    req.onsuccess = () => resolve(req.result)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(IDB_STORE)) {
        db.createObjectStore(IDB_STORE, { keyPath: 'userId' })
      }
    }
  })
}

async function idbGet(userId: string): Promise<LocalWalletRecord | null> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readonly')
    const store = tx.objectStore(IDB_STORE)
    const req = store.get(userId)
    req.onsuccess = () => resolve((req.result as LocalWalletRecord | undefined) ?? null)
    req.onerror = () => reject(req.error ?? new Error('IndexedDB read failed'))
    tx.oncomplete = () => db.close()
  })
}

async function idbPut(record: LocalWalletRecord): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const req = store.put(record)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB write failed'))
    tx.oncomplete = () => db.close()
  })
}

async function idbDelete(userId: string): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, 'readwrite')
    const store = tx.objectStore(IDB_STORE)
    const req = store.delete(userId)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error ?? new Error('IndexedDB delete failed'))
    tx.oncomplete = () => db.close()
  })
}

/** Persist encrypted wallet locally (never plaintext). */
export async function saveEncryptedWallet(record: LocalWalletRecord): Promise<void> {
  const payload = { ...record, updatedAt: new Date().toISOString() }
  try {
    await idbPut(payload)
  } catch {
    localStorage.setItem(lsKey(record.userId), JSON.stringify(payload))
  }
}

export async function loadEncryptedWallet(userId: string): Promise<LocalWalletRecord | null> {
  try {
    const fromIdb = await idbGet(userId)
    if (fromIdb) return fromIdb
  } catch {
    // fall through
  }
  const raw = localStorage.getItem(lsKey(userId))
  if (!raw) return null
  try {
    return JSON.parse(raw) as LocalWalletRecord
  } catch {
    return null
  }
}

export async function clearWallet(userId: string): Promise<void> {
  try {
    await idbDelete(userId)
  } catch {
    // ignore
  }
  localStorage.removeItem(lsKey(userId))
}
