/**
 * Fire-and-forget: ask the server to ping the verifier Telegram channel
 * after a successful onchain cleanup submission.
 */

export function notifyVerifierTelegramOfSubmission(params: {
  submissionId: string
  txHash?: string
}): void {
  if (typeof window === 'undefined') return

  const body: Record<string, string> = {
    submissionId: params.submissionId,
  }
  if (params.txHash) body.txHash = params.txHash

  void fetch('/api/telegram/submission-created', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch((err) => {
    console.warn('[notifyVerifierTelegram] failed (non-fatal):', err)
  })
}
