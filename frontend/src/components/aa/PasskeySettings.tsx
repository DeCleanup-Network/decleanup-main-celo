'use client'

import { useCallback, useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { EnablePasskey } from '@/components/aa/EnablePasskey'
import { useWallet } from '@/providers/WalletProvider'
import { fetchPasskeyStatus, removePasskey } from '@/lib/passkey/client-api'
import { clearPasskeyUnlockRecord } from '@/lib/client-wallet/passkey-unlock'
import { useSession } from 'next-auth/react'
import { isPasskeySupported } from '@/lib/passkey/config-client'
import { BIOMETRIC_UNLOCK_LOWER, WALLET_PASSKEY, WALLET_PASSKEY_LOWER } from '@/lib/client-wallet/copy'

export function PasskeySettings() {
  const { data: session } = useSession()
  const userId = session?.user?.id
  const { isPasskeyEnabled, refreshPasskeyStatus } = useWallet()
  const [open, setOpen] = useState(false)
  const [serverCount, setServerCount] = useState(0)
  const [credentials, setCredentials] = useState<
    Array<{ id: string; deviceType: string | null; createdAt: string }>
  >([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const status = await fetchPasskeyStatus()
      setServerCount(status.count)
      setCredentials(status.credentials)
      await refreshPasskeyStatus()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load biometric settings')
    } finally {
      setLoading(false)
    }
  }, [refreshPasskeyStatus])

  useEffect(() => {
    if (!open) return
    void load()
  }, [open, load])

  const removeAll = async () => {
    if (!userId) return
    if (!window.confirm(`Remove ${BIOMETRIC_UNLOCK_LOWER}? You will need your ${WALLET_PASSKEY_LOWER} to unlock.`))
      return
    setRemoving(true)
    setError(null)
    try {
      await removePasskey({ removeAll: true })
      clearPasskeyUnlockRecord(userId)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to remove biometrics')
    } finally {
      setRemoving(false)
    }
  }

  if (!isPasskeySupported()) {
    return (
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 px-5 py-4">
        <p className="text-sm text-gray-400">
          Face ID / Touch ID is not available here. {WALLET_PASSKEY} unlock still works.
        </p>
      </div>
    )
  }

  const statusLabel = isPasskeyEnabled
    ? 'On this device'
    : serverCount > 0
      ? 'Registered'
      : 'Off'

  return (
    <details
      className="group rounded-xl border border-gray-800 bg-gray-900/50 open:bg-gray-900/60"
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4 marker:content-none [&::-webkit-details-marker]:hidden">
        <span className="text-base font-semibold text-white">Face ID / Touch ID</span>
        <span
          className={`text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full ${
            isPasskeyEnabled || serverCount > 0
              ? 'bg-brand-green/20 text-brand-green'
              : 'bg-gray-800 text-gray-500'
          }`}
        >
          {statusLabel}
        </span>
      </summary>
      <div className="space-y-4 border-t border-gray-800 px-5 pb-5 pt-3">
        {open && loading ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : open ? (
          <>
            {credentials.length > 0 && isPasskeyEnabled ? (
              <p className="text-xs text-gray-500">{credentials.length} device(s) registered</p>
            ) : null}

            {!isPasskeyEnabled && <EnablePasskey onEnabled={() => void load()} />}

            {(serverCount > 0 || isPasskeyEnabled) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={removing}
                className="border-red-900/50 text-red-300 hover:bg-red-950/30"
                onClick={() => void removeAll()}
              >
                {removing ? 'Removing…' : 'Remove biometrics'}
              </Button>
            )}
          </>
        ) : null}

        {error && <p className="text-sm text-red-400">{error}</p>}
      </div>
    </details>
  )
}
