'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSession } from 'next-auth/react'
import { isEmbeddedAuthProvider } from '@/lib/auth/embedded-auth'
import type { Address, Hex } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createClientWallet } from '@/lib/client-wallet/createWallet'
import { decryptPrivateKey, encryptPrivateKey } from '@/lib/client-wallet/encryption'
import {
  clearDeviceSeal,
  decryptWithDeviceSeal,
  encryptWithDeviceSeal,
} from '@/lib/client-wallet/device-seal'
import {
  clearWallet,
  loadEncryptedWallet,
  saveEncryptedWallet,
} from '@/lib/client-wallet/storage'
import {
  clearPasskeyUnlockRecord,
  hasPasskeyUnlockRecord,
} from '@/lib/client-wallet/passkey-unlock'
import { authenticatePasskey, registerPasskey as registerPasskeyApi } from '@/lib/passkey/client-api'
import type { WalletBackupFile } from '@/lib/client-wallet/backup'
import {
  createWalletBackupFile,
  downloadWalletBackupFile,
} from '@/lib/client-wallet/backup'
import type { EncryptedWalletBlob, LocalWalletRecord } from '@/lib/client-wallet/types'
import { WALLET_PASSKEY, WALLET_PASSKEY_POSSESSIVE } from '@/lib/client-wallet/copy'
import { REQUIRED_CHAIN_ID } from '@/lib/blockchain/chain-constants'
import { predictSafeAddress } from '@/lib/smart-account/predict-safe'
import {
  createClientSmartAccountClient,
  getClientSmartAccountBalance,
  getClientUserOperationReceipt,
  sendGaslessUserOperation,
} from '@/lib/smart-account/client'
import type { GaslessClient } from '@/lib/blockchain/contracts'
import {
  assertSessionCanSign,
  createSigningSession,
  getPreferredSessionDuration,
  isSessionWithoutAutoExpiry,
  isSigningSessionActive,
  refreshSigningSessionExpiry,
  setPreferredSessionDuration,
  type ActiveSigningSession,
  type SessionDurationId,
} from '@/lib/client-wallet/signing-session'
import { fetchWithTimeout } from '@/lib/utils/fetch-with-timeout'

export type WalletPhase =
  | 'loading'
  | 'no-wallet'
  /** Wallet created on sign-in; signing password deferred until first on-chain action. */
  | 'pending-password'
  | 'locked'
  | 'unlocked'
  | 'server-only'

type WalletContextValue = {
  phase: WalletPhase
  eoaAddress: Address | null
  smartAccountAddress: Address | null
  chainId: number | null
  balance: string | null
  gaslessEnabled: boolean
  error: string | null
  setupWallet: (password: string) => Promise<void>
  /** First-time password after auto-created wallet (device seal → user password). */
  setSigningPassword: (password: string, sessionDuration?: SessionDurationId) => Promise<void>
  needsSigningPassword: boolean
  importWallet: (privateKeyHex: Hex, password: string) => Promise<void>
  unlock: (password: string, sessionDuration?: SessionDurationId) => Promise<void>
  unlockWithPasskey: (sessionDuration?: SessionDurationId) => Promise<void>
  lock: () => void
  /** Temporary delegated signer — active until session expires. */
  signingSession: ActiveSigningSession | null
  hasActiveSigningSession: boolean
  endSigningSession: () => void
  refreshBalance: () => Promise<void>
  sendTransaction: (params: { to: Address; value?: bigint; data?: Hex }) => Promise<Hex>
  /** Pimlico smart-account client for contract writes when signing session is active. */
  getGaslessClient: () => Promise<GaslessClient | null>
  /** Pay-gas contract write from embedded EOA (e.g. Impact Product claim when submission owner is EOA). */
  writeContractAsEoa: (params: {
    address: Address
    abi: readonly unknown[]
    functionName: string
    args: readonly unknown[]
    value?: bigint
  }) => Promise<Hex>
  getReceipt: (userOpHash: Hex) => ReturnType<typeof getClientUserOperationReceipt>
  exportEncryptedBackup: () => EncryptedWalletBlob | null
  downloadEncryptedBackup: (unlockPassword: string) => Promise<void>
  /** Export backup while signing session is active (no password re-entry). */
  downloadEncryptedBackupInSession: () => Promise<void>
  verifyBackupPassword: (backup: WalletBackupFile, unlockPassword: string) => Promise<void>
  importFromBackup: (backup: WalletBackupFile, unlockPassword: string) => Promise<void>
  decryptForExport: (password: string) => Promise<Hex>
  /** Reveal private key while signing session is active (no password re-entry). */
  decryptForExportInSession: () => Hex
  clearLocalWallet: () => Promise<void>
  isNewDevice: boolean
  isPasskeyEnabled: boolean
  passkeyLoading: boolean
  refreshPasskeyStatus: () => Promise<void>
  registerPasskey: (unlockPassword: string) => Promise<void>
  /** Last resort: delete wallet metadata and bootstrap a new address (not a passkey reset). */
  resetWalletAccess: () => Promise<void>
  /** Re-run wallet hydrate (e.g. stuck setup screen). */
  retryWalletBootstrap: () => void
}

const WalletContext = createContext<WalletContextValue | null>(null)

function zeroizeKey(ref: { current: Hex | null }) {
  ref.current = null
}

async function syncWalletToServer(record: LocalWalletRecord) {
  const res = await fetchWithTimeout(
    '/api/aa/wallet',
    {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        address: record.address,
        smartAccountAddress: record.smartAccountAddress,
        encryptedBlob: record.encryptedBlob,
        chainId: record.chainId,
      }),
    },
    25_000
  )
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? 'Failed to sync wallet to server')
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const { data: session, status: sessionStatus } = useSession()
  const userId = session?.user?.id ?? null
  const embeddedAuth = isEmbeddedAuthProvider(session?.authProvider)

  const [phase, setPhase] = useState<WalletPhase>('loading')
  const [eoaAddress, setEoaAddress] = useState<Address | null>(null)
  const [smartAccountAddress, setSmartAccountAddress] = useState<Address | null>(null)
  const [chainId, setChainId] = useState<number | null>(null)
  const [balance, setBalance] = useState<string | null>(null)
  const [gaslessEnabled, setGaslessEnabled] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPasskeyEnabled, setIsPasskeyEnabled] = useState(false)
  const [isNewDevice, setIsNewDevice] = useState(false)
  const [passkeyLoading, setPasskeyLoading] = useState(false)
  const [signingSession, setSigningSession] = useState<ActiveSigningSession | null>(null)

  const privateKeyRef = useRef<Hex | null>(null)
  const localRecordRef = useRef<LocalWalletRecord | null>(null)
  const sessionTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hydrateInFlightRef = useRef(false)
  const [bootstrapNonce, setBootstrapNonce] = useState(0)

  const clearSessionTimer = useCallback(() => {
    if (sessionTimerRef.current) {
      clearTimeout(sessionTimerRef.current)
      sessionTimerRef.current = null
    }
  }, [])

  const endSigningSession = useCallback(() => {
    clearSessionTimer()
    zeroizeKey(privateKeyRef)
    setSigningSession(null)
    setPhase(localRecordRef.current ? 'locked' : 'no-wallet')
  }, [clearSessionTimer])

  const scheduleSessionExpiry = useCallback(
    (session: ActiveSigningSession) => {
      clearSessionTimer()
      if (isSessionWithoutAutoExpiry(session.durationId)) return
      const ms = Math.max(0, session.expiresAt - Date.now())
      sessionTimerRef.current = setTimeout(() => {
        endSigningSession()
      }, ms)
    },
    [clearSessionTimer, endSigningSession]
  )

  const startSigningSession = useCallback(
    (durationId: SessionDurationId) => {
      setPreferredSessionDuration(durationId)
      const session = createSigningSession(durationId)
      setSigningSession(session)
      scheduleSessionExpiry(session)
      setPhase('unlocked')
    },
    [scheduleSessionExpiry]
  )

  const extendSigningSession = useCallback(() => {
    setSigningSession((prev) => {
      if (!prev || !isSigningSessionActive(prev)) return prev
      if (isSessionWithoutAutoExpiry(prev.durationId)) return prev
      const extended = refreshSigningSessionExpiry(prev)
      scheduleSessionExpiry(extended)
      return extended
    })
  }, [scheduleSessionExpiry])

  const lock = useCallback(() => {
    endSigningSession()
  }, [endSigningSession])

  const hasActiveSigningSession = isSigningSessionActive(signingSession)

  const refreshPasskeyStatus = useCallback(async () => {
    if (!userId) {
      setIsPasskeyEnabled(false)
      return
    }
    setIsPasskeyEnabled(hasPasskeyUnlockRecord(userId))
  }, [userId])

  const refreshBalance = useCallback(async () => {
    if (!smartAccountAddress) return
    try {
      const bal = await getClientSmartAccountBalance(smartAccountAddress)
      setBalance(bal)
    } catch {
      // balance fetch is best-effort
    }
  }, [smartAccountAddress])

  const applyRecord = useCallback((record: LocalWalletRecord, unlocked: boolean) => {
    localRecordRef.current = record
    setEoaAddress(record.address)
    setSmartAccountAddress(record.smartAccountAddress)
    setChainId(record.chainId)
    if (record.pendingSigningPassword) {
      setPhase('pending-password')
      return
    }
    setPhase(unlocked ? 'unlocked' : 'locked')
  }, [])

  const persistAndSync = useCallback(
    async (record: LocalWalletRecord) => {
      await saveEncryptedWallet(record)
      localRecordRef.current = record
      await syncWalletToServer(record)
    },
    []
  )

  const createWalletRecord = useCallback(
    async (privateKeyHex: Hex, password: string) => {
      if (!userId) throw new Error('Not signed in')
      const account = privateKeyToAccount(privateKeyHex)
      const smart = await predictSafeAddress(account)
      const encryptedBlob = await encryptPrivateKey(privateKeyHex, password)
      const record: LocalWalletRecord = {
        userId,
        address: account.address,
        smartAccountAddress: smart,
        encryptedBlob,
        chainId: REQUIRED_CHAIN_ID,
        updatedAt: new Date().toISOString(),
      }
      return record
    },
    [userId]
  )

  const autoCreateWallet = useCallback(async () => {
    if (!userId) throw new Error('Not signed in')
    setError(null)
    const { privateKey } = createClientWallet()
    const account = privateKeyToAccount(privateKey)
    const smart = await predictSafeAddress(account)
    const encryptedBlob = await encryptWithDeviceSeal(privateKey, userId)
    const record: LocalWalletRecord = {
      userId,
      address: account.address,
      smartAccountAddress: smart,
      encryptedBlob,
      chainId: REQUIRED_CHAIN_ID,
      updatedAt: new Date().toISOString(),
      pendingSigningPassword: true,
    }
    await persistAndSync(record)
    applyRecord(record, false)
    void refreshBalance().catch(() => {
      /* balance is optional during setup */
    })
  }, [userId, persistAndSync, applyRecord, refreshBalance])

  const setSigningPassword = useCallback(
    async (password: string, sessionDuration?: SessionDurationId) => {
      if (!userId) throw new Error('Not signed in')
      const record = localRecordRef.current
      if (!record?.pendingSigningPassword) {
        throw new Error(`${WALLET_PASSKEY} already set`)
      }
      setError(null)
      const key = (await decryptWithDeviceSeal(record.encryptedBlob, userId)) as Hex
      const encryptedBlob = await encryptPrivateKey(key, password)
      const updated: LocalWalletRecord = {
        ...record,
        encryptedBlob,
        pendingSigningPassword: false,
        updatedAt: new Date().toISOString(),
      }
      privateKeyRef.current = key
      await persistAndSync(updated)
      clearDeviceSeal(userId)
      applyRecord(updated, false)
      setIsPasskeyEnabled(hasPasskeyUnlockRecord(userId))
      startSigningSession(sessionDuration ?? getPreferredSessionDuration())
      await refreshBalance()
    },
    [userId, persistAndSync, applyRecord, refreshBalance, startSigningSession]
  )

  const setupWallet = useCallback(
    async (password: string) => {
      setError(null)
      const { privateKey } = createClientWallet()
      const record = await createWalletRecord(privateKey, password)
      privateKeyRef.current = privateKey
      await persistAndSync(record)
      applyRecord(record, false)
      startSigningSession(getPreferredSessionDuration())
      await refreshBalance()
    },
    [applyRecord, createWalletRecord, persistAndSync, refreshBalance, startSigningSession]
  )

  const importWallet = useCallback(
    async (privateKeyHex: Hex, password: string) => {
      setError(null)
      const record = await createWalletRecord(privateKeyHex, password)
      privateKeyRef.current = privateKeyHex
      await persistAndSync(record)
      applyRecord(record, false)
      startSigningSession(getPreferredSessionDuration())
      await refreshBalance()
    },
    [applyRecord, createWalletRecord, persistAndSync, refreshBalance, startSigningSession]
  )

  const unlockWithPassword = useCallback(
    async (password: string, sessionDuration?: SessionDurationId) => {
      const record = localRecordRef.current
      if (!record) throw new Error('No wallet found on this device')
      if (record.pendingSigningPassword) {
        throw new Error(`Set ${WALLET_PASSKEY_POSSESSIVE} first`)
      }
      const key = (await decryptPrivateKey(record.encryptedBlob, password)) as Hex
      privateKeyRef.current = key
      setIsNewDevice(false)
      startSigningSession(sessionDuration ?? getPreferredSessionDuration())
      await refreshBalance()
    },
    [refreshBalance, startSigningSession]
  )

  const unlock = useCallback(
    async (password: string, sessionDuration?: SessionDurationId) => {
      setError(null)
      try {
        await unlockWithPassword(password, sessionDuration)
      } catch {
        throw new Error('Incorrect password or corrupted wallet data.')
      }
    },
    [unlockWithPassword]
  )

  const registerPasskey = useCallback(
    async (unlockPassword: string) => {
      if (!userId) throw new Error('Not signed in')
      setPasskeyLoading(true)
      setError(null)
      try {
        const record = localRecordRef.current
        if (!record) throw new Error('No wallet on this device')
        await decryptPrivateKey(record.encryptedBlob, unlockPassword)
        await registerPasskeyApi(userId, unlockPassword)
        setIsPasskeyEnabled(true)
      } finally {
        setPasskeyLoading(false)
      }
    },
    [userId]
  )

  const unlockWithPasskey = useCallback(
    async (sessionDuration?: SessionDurationId) => {
      if (!userId) throw new Error('Not signed in')
      setPasskeyLoading(true)
      setError(null)
      let unlockKey: string | null = null
      let password: string | null = null
      try {
        unlockKey = await authenticatePasskey()
        const { unwrapUnlockPassword } = await import('@/lib/client-wallet/passkey-unlock')
        password = await unwrapUnlockPassword(userId, unlockKey)
        await unlockWithPassword(password, sessionDuration)
      } catch (e) {
        const { formatWebAuthnError } = await import('@/lib/passkey/errors')
        throw new Error(formatWebAuthnError(e))
      } finally {
        unlockKey = null
        password = null
        setPasskeyLoading(false)
      }
    },
    [userId, unlockWithPassword]
  )

  const sendTransaction = useCallback(
    async (params: { to: Address; value?: bigint; data?: Hex }) => {
      const key = privateKeyRef.current
      assertSessionCanSign(signingSession, params)
      if (!key || !isSigningSessionActive(signingSession)) {
        throw new Error('Signing session expired. Unlock your wallet to continue.')
      }
      extendSigningSession()
      const { userOpHash } = await sendGaslessUserOperation(key, params)
      void refreshBalance()
      return userOpHash
    },
    [signingSession, extendSigningSession, refreshBalance]
  )

  const getGaslessClient = useCallback(async (): Promise<GaslessClient | null> => {
    const key = privateKeyRef.current
    if (!key || !isSigningSessionActive(signingSession)) return null
    const client = await createClientSmartAccountClient(key)
    const accountAddress = (client as { account?: { address?: Address } }).account?.address
    return {
      accountAddress,
      sendTransaction: (params) =>
        client.sendTransaction({
          to: params.to,
          value: params.value ?? 0n,
          data: params.data ?? '0x',
        }),
    }
  }, [signingSession])

  const writeContractAsEoa = useCallback(
    async (params: {
      address: Address
      abi: readonly unknown[]
      functionName: string
      args: readonly unknown[]
      value?: bigint
    }) => {
      const key = privateKeyRef.current
      if (!key || !isSigningSessionActive(signingSession)) {
        throw new Error('Unlock your wallet in Account settings to continue.')
      }
      extendSigningSession()
      const { writeContractWithEmbeddedEoa } = await import('@/lib/aa/embedded-eoa-write')
      return writeContractWithEmbeddedEoa(key, params)
    },
    [signingSession, extendSigningSession]
  )

  const getReceipt = useCallback((userOpHash: Hex) => {
    return getClientUserOperationReceipt(userOpHash)
  }, [])

  const exportEncryptedBackup = useCallback(() => {
    return localRecordRef.current?.encryptedBlob ?? null
  }, [])

  const verifyBackupPassword = useCallback(
    async (backup: WalletBackupFile, unlockPassword: string) => {
      await decryptPrivateKey(backup.encryptedBlob, unlockPassword)
    },
    []
  )

  const importFromBackup = useCallback(
    async (backup: WalletBackupFile, unlockPassword: string) => {
      if (!userId) throw new Error('Not signed in')
      setError(null)
      await decryptPrivateKey(backup.encryptedBlob, unlockPassword)
      const record: LocalWalletRecord = {
        userId,
        address: backup.eoaAddress,
        smartAccountAddress: backup.smartAccountAddress,
        encryptedBlob: backup.encryptedBlob,
        chainId: backup.chainId,
        updatedAt: new Date().toISOString(),
      }
      await persistAndSync(record)
      applyRecord(record, false)
      setIsNewDevice(!hasPasskeyUnlockRecord(userId))
      await refreshBalance()
    },
    [userId, persistAndSync, applyRecord, refreshBalance]
  )

  const downloadEncryptedBackup = useCallback(
    async (unlockPassword: string) => {
      const record = localRecordRef.current
      if (!record) throw new Error('No wallet on this device')
      if (record.pendingSigningPassword) {
        throw new Error(`Set ${WALLET_PASSKEY_POSSESSIVE} before downloading a backup.`)
      }
      await decryptPrivateKey(record.encryptedBlob, unlockPassword)
      const file = await createWalletBackupFile(record)
      downloadWalletBackupFile(file)
    },
    []
  )

  const downloadEncryptedBackupInSession = useCallback(async () => {
    const record = localRecordRef.current
    if (!record) throw new Error('No wallet on this device')
    if (record.pendingSigningPassword) {
      throw new Error(`Set ${WALLET_PASSKEY_POSSESSIVE} before downloading a backup.`)
    }
    if (!privateKeyRef.current || !isSigningSessionActive(signingSession)) {
      throw new Error('Unlock your wallet first, then download the backup.')
    }
    const file = await createWalletBackupFile(record)
    downloadWalletBackupFile(file)
  }, [signingSession])

  const decryptForExport = useCallback(async (password: string) => {
    const record = localRecordRef.current
    if (!record) throw new Error('No wallet on this device')
    return (await decryptPrivateKey(record.encryptedBlob, password)) as Hex
  }, [])

  const decryptForExportInSession = useCallback((): Hex => {
    const key = privateKeyRef.current
    if (!key || !isSigningSessionActive(signingSession)) {
      throw new Error('Unlock your wallet first.')
    }
    return key
  }, [signingSession])

  const clearLocalWallet = useCallback(async () => {
    if (!userId) return
    lock()
    clearPasskeyUnlockRecord(userId)
    setIsPasskeyEnabled(false)
    await clearWallet(userId)
    localRecordRef.current = null
    setEoaAddress(null)
    setSmartAccountAddress(null)
    setChainId(null)
    setBalance(null)
    setPhase('no-wallet')
  }, [lock, userId])

  const resetWalletAccess = useCallback(async () => {
    if (!userId) throw new Error('Not signed in')
    setError(null)
    lock()

    const resetRes = await fetchWithTimeout(
      '/api/aa/wallet',
      { method: 'DELETE', credentials: 'include' },
      20_000
    )
    const resetJson = await resetRes.json().catch(() => ({}))
    if (!resetRes.ok) {
      throw new Error(resetJson.error ?? 'Failed to reset wallet on server')
    }

    await fetchWithTimeout(
      '/api/passkey/remove',
      {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ removeAll: true }),
      },
      20_000
    ).catch(() => {
      // Non-fatal: reset can continue even when passkey cleanup fails.
    })

    clearPasskeyUnlockRecord(userId)
    await clearWallet(userId)
    localRecordRef.current = null
    setIsPasskeyEnabled(false)
    setEoaAddress(null)
    setSmartAccountAddress(null)
    setChainId(null)
    setBalance(null)
    setPhase('no-wallet')
    setBootstrapNonce((n) => n + 1)
  }, [lock, userId])

  const retryWalletBootstrap = useCallback(() => {
    setError(null)
    hydrateInFlightRef.current = false
    setBootstrapNonce((n) => n + 1)
  }, [])

  useEffect(() => {
    if (sessionStatus !== 'authenticated' || !userId || !embeddedAuth) {
      if (sessionStatus === 'unauthenticated' || !embeddedAuth) {
        lock()
        localRecordRef.current = null
        setPhase('loading')
      }
      return
    }

    let cancelled = false

    async function hydrate() {
      const uid = userId
      if (!uid || hydrateInFlightRef.current) return
      hydrateInFlightRef.current = true

      if (localRecordRef.current?.userId !== uid) {
        setPhase('loading')
      }
      setError(null)

      try {
        const local = await loadEncryptedWallet(uid)

        let server: {
          hasWallet?: boolean
          gaslessEnabled?: boolean
          eoaAddress?: string
          smartAccountAddress?: string
          encryptedBlob?: unknown
          chainId?: number
          balance?: string | null
          error?: string
        } = {}

        try {
          const serverRes = await fetchWithTimeout('/api/aa/wallet', { credentials: 'include' }, 20_000)
          server = await serverRes.json()
          if (!serverRes.ok && serverRes.status !== 401) {
            console.warn('[WalletProvider] /api/aa/wallet:', server.error ?? serverRes.status)
          }
        } catch (e) {
          console.warn('[WalletProvider] wallet API unreachable:', e)
        }

        if (cancelled) return

        setGaslessEnabled(Boolean(server.gaslessEnabled))

        if (local) {
          applyRecord(local, false)
          setIsPasskeyEnabled(hasPasskeyUnlockRecord(uid))
          if (server.hasWallet && server.smartAccountAddress) {
            setBalance(server.balance ?? null)
          }
          return
        }

        if (server.hasWallet && server.encryptedBlob && server.eoaAddress && server.smartAccountAddress) {
          const record: LocalWalletRecord = {
            userId: uid,
            address: server.eoaAddress as Address,
            smartAccountAddress: server.smartAccountAddress as Address,
            encryptedBlob: server.encryptedBlob as LocalWalletRecord['encryptedBlob'],
            chainId: server.chainId ?? REQUIRED_CHAIN_ID,
            updatedAt: new Date().toISOString(),
          }
          await saveEncryptedWallet(record)
          applyRecord(record, false)
          setBalance(server.balance ?? null)
          setIsNewDevice(!hasPasskeyUnlockRecord(uid))
          return
        }

        if (server.hasWallet) {
          setEoaAddress(server.eoaAddress as Address)
          setSmartAccountAddress(server.smartAccountAddress as Address)
          setChainId(server.chainId ?? null)
          setBalance(server.balance ?? null)
          setPhase('server-only')
          return
        }

        if (!cancelled) {
          setIsPasskeyEnabled(hasPasskeyUnlockRecord(uid))
          try {
            await autoCreateWallet()
          } catch (e) {
            setError(e instanceof Error ? e.message : 'Failed to create wallet')
            setPhase('no-wallet')
          }
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load wallet')
          setPhase('no-wallet')
        }
      } finally {
        hydrateInFlightRef.current = false
      }
    }

    void hydrate()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- phase read only to avoid reset loop
  }, [sessionStatus, userId, bootstrapNonce, embeddedAuth])

  useEffect(() => {
    const onActivity = () => {
      if (privateKeyRef.current && signingSession) extendSigningSession()
    }
    window.addEventListener('pointerdown', onActivity)
    window.addEventListener('keydown', onActivity)
    return () => {
      window.removeEventListener('pointerdown', onActivity)
      window.removeEventListener('keydown', onActivity)
    }
  }, [signingSession, extendSigningSession])

  useEffect(() => {
    if (sessionStatus === 'authenticated' && userId) {
      void refreshPasskeyStatus()
    }
  }, [sessionStatus, userId, refreshPasskeyStatus])

  useEffect(() => {
    return () => {
      clearSessionTimer()
      zeroizeKey(privateKeyRef)
    }
  }, [clearSessionTimer])

  const value = useMemo<WalletContextValue>(
    () => ({
      phase,
      eoaAddress,
      smartAccountAddress,
      chainId,
      balance,
      gaslessEnabled,
      error,
      setupWallet,
      setSigningPassword,
      needsSigningPassword: phase === 'pending-password',
      importWallet,
      unlock,
      unlockWithPasskey,
      lock,
      signingSession,
      hasActiveSigningSession,
      endSigningSession,
      refreshBalance,
      sendTransaction,
      getGaslessClient,
      writeContractAsEoa,
      getReceipt,
      exportEncryptedBackup,
      downloadEncryptedBackup,
      downloadEncryptedBackupInSession,
      verifyBackupPassword,
      importFromBackup,
      decryptForExport,
      decryptForExportInSession,
      clearLocalWallet,
      isNewDevice,
      isPasskeyEnabled,
      passkeyLoading,
      refreshPasskeyStatus,
      registerPasskey,
      resetWalletAccess,
      retryWalletBootstrap,
    } satisfies WalletContextValue),
    [
      phase,
      eoaAddress,
      smartAccountAddress,
      chainId,
      balance,
      gaslessEnabled,
      error,
      setupWallet,
      setSigningPassword,
      importWallet,
      unlock,
      unlockWithPasskey,
      lock,
      signingSession,
      hasActiveSigningSession,
      endSigningSession,
      refreshBalance,
      sendTransaction,
      getGaslessClient,
      writeContractAsEoa,
      getReceipt,
      exportEncryptedBackup,
      downloadEncryptedBackup,
      downloadEncryptedBackupInSession,
      verifyBackupPassword,
      importFromBackup,
      decryptForExport,
      decryptForExportInSession,
      clearLocalWallet,
      isNewDevice,
      isPasskeyEnabled,
      passkeyLoading,
      refreshPasskeyStatus,
      registerPasskey,
      resetWalletAccess,
      retryWalletBootstrap,
    ]
  )

  return <WalletContext.Provider value={value}>{children}</WalletContext.Provider>
}

export function useWallet() {
  const ctx = useContext(WalletContext)
  if (!ctx) throw new Error('useWallet must be used within WalletProvider')
  return ctx
}
