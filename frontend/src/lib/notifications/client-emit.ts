/** Client helper to emit notification events (fire-and-forget). */
export function emitNotificationEvent(payload: Record<string, unknown>): void {
  if (typeof window === 'undefined') return
  void fetch('/api/notifications/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn('[notifications] emit failed', err))
}

export function registerContributorsClient(payload: {
  submissionId: string
  contributors: string[]
  submitterWallet?: string
}): void {
  if (typeof window === 'undefined') return
  void fetch('/api/contributors/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn('[contributors] register failed', err))
}
