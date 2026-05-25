'use client'

import {
  SESSION_DURATION_OPTIONS,
  setPreferredSessionDuration,
  type SessionDurationId,
} from '@/lib/client-wallet/signing-session'

type Props = {
  duration: SessionDurationId
  onDurationChange: (id: SessionDurationId) => void
  compact?: boolean
}

export function SigningSessionDurationField({
  duration,
  onDurationChange,
  compact = false,
}: Props) {
  const handleDurationChange = (id: SessionDurationId) => {
    setPreferredSessionDuration(id)
    onDurationChange(id)
  }

  return (
    <label className={compact ? 'block' : 'block space-y-1'}>
      {!compact && (
        <span className="text-sm text-gray-400">Stay unlocked for (saved on this device only)</span>
      )}
      <select
        value={duration}
        onChange={(e) => handleDurationChange(e.target.value as SessionDurationId)}
        className={
          compact
            ? 'inline rounded border border-gray-700 bg-black px-1.5 py-0.5 text-gray-300'
            : 'w-full rounded-lg border border-gray-700 bg-black px-3 py-2 text-sm text-white'
        }
        aria-label="Signing session duration"
      >
        {SESSION_DURATION_OPTIONS.map((opt) => (
          <option key={opt.id} value={opt.id}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
