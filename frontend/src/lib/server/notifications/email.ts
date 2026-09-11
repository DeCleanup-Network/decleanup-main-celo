import 'server-only'

type SendParams = {
  to: string
  subject: string
  title: string
  body: string
  href?: string | null
}

function appBaseUrl(): string {
  return (
    process.env.NEXT_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_URL_BASE ||
    'https://dapp.decleanup.net'
  ).replace(/\/$/, '')
}

/**
 * Short HTML notification via Resend (same pattern as magic-link).
 */
export async function sendNotificationEmail(params: SendParams): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  const from = process.env.EMAIL_FROM?.trim() || process.env.RESEND_FROM?.trim()
  if (!apiKey || !from) return

  const link = params.href
    ? params.href.startsWith('http')
      ? params.href
      : `${appBaseUrl()}${params.href.startsWith('/') ? '' : '/'}${params.href}`
    : appBaseUrl()

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: params.subject,
      html: `
        <div style="font-family:system-ui,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:24px;color:#111">
          <p style="font-size:12px;letter-spacing:0.08em;text-transform:uppercase;color:#16a34a;margin:0 0 8px">DeCleanup Rewards</p>
          <h1 style="font-size:20px;margin:0 0 12px">${escapeHtml(params.title)}</h1>
          <p style="font-size:15px;line-height:1.5;color:#333;margin:0 0 20px">${escapeHtml(params.body)}</p>
          <p style="margin:0 0 24px">
            <a href="${link}" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;padding:10px 16px;border-radius:8px;font-weight:600">Open app</a>
          </p>
          <p style="font-size:11px;color:#888;margin:0">You received this because notifications are on for your account. Manage preferences in Account settings.</p>
        </div>
      `.trim(),
    }),
  })

  if (!res.ok) {
    const detail = await res.text().catch(() => '')
    console.warn('[notifications/email] Resend failed:', res.status, detail.slice(0, 200))
  }
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
