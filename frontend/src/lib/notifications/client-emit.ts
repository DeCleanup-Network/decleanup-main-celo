/** Client helper to emit notification events. */
export async function emitNotificationEvent(
  payload: Record<string, unknown>
): Promise<{ ok: boolean; status: number; body?: Record<string, unknown> }> {
  if (typeof window === 'undefined') return { ok: false, status: 0 }
  try {
    const res = await fetch('/api/notifications/events', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })
    const body = (await res.json().catch(() => ({}))) as Record<string, unknown>
    if (!res.ok) {
      console.warn('[notifications] emit failed', res.status, body)
      return { ok: false, status: res.status, body }
    }
    if (body.matchedUser === false || body.notified === false) {
      console.warn('[notifications] emit ok but no registered user matched', body)
    }
    return { ok: true, status: res.status, body }
  } catch (err) {
    console.warn('[notifications] emit failed', err)
    return { ok: false, status: 0 }
  }
}

export function registerContributorsClient(payload: {
  submissionId: string
  contributors: string[]
  submitterWallet?: string
}): void {
  if (typeof window === 'undefined') return
  void fetch('/api/contributors/register', {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  }).catch((err) => console.warn('[contributors] register failed', err))
}
