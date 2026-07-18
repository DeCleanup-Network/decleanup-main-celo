/**
 * Fire-and-forget: ask the server to ping the verifier Telegram channel
 * after a successful onchain cleanup submission.
 *
 * Embedded / AA submits are slower and mobile Safari often cancels in-flight
 * fetches if the tab backgrounds — use keepalive + more retries.
 */

const CLIENT_RETRIES = 5
const CLIENT_RETRY_DELAY_MS = 2_500

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

type NotifyResponse = {
  ok?: boolean
  sent?: boolean
  skipped?: boolean
  reason?: string
  detail?: string
}

async function postSubmissionNotify(
  body: Record<string, string>,
  attempt: number
): Promise<void> {
  const res = await fetch('/api/telegram/submission-created', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    // Survive tab backgrounding / navigation on mobile (esp. after long AA UserOps)
    keepalive: true,
  })

  const data = (await res.json().catch(() => ({}))) as NotifyResponse

  if (!res.ok) {
    throw new Error(data.detail || data.reason || `HTTP ${res.status}`)
  }

  if (data.sent === true) return

  if (data.skipped || data.sent === false) {
    const retryable =
      attempt < CLIENT_RETRIES - 1 &&
      (data.reason === 'not_found' ||
        data.reason === 'not_pending' ||
        data.reason === 'telegram_error')
    if (retryable) {
      await sleep(CLIENT_RETRY_DELAY_MS * (attempt + 1))
      return postSubmissionNotify(body, attempt + 1)
    }
    console.warn('[notifyVerifierTelegram] alert not sent:', data)
  }
}

export function notifyVerifierTelegramOfSubmission(params: {
  submissionId: string
  txHash?: string
}): void {
  if (typeof window === 'undefined') return

  const body: Record<string, string> = {
    submissionId: params.submissionId,
  }
  if (params.txHash) body.txHash = params.txHash

  void postSubmissionNotify(body, 0).catch((err) => {
    console.warn('[notifyVerifierTelegram] failed (non-fatal):', err)
  })
}
