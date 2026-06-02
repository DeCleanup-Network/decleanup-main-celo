import 'server-only'

type SendParams = {
  apiKey: string
  from: string
  to: string
  url: string
}

/**
 * Send Auth.js magic-link email via Resend HTTP API (preferred over SMTP URL).
 * @see https://resend.com/docs/api-reference/emails/send-email
 */
export async function sendResendMagicLink({ apiKey, from, to, url }: SendParams): Promise<void> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [to],
      subject: 'Sign in to DeCleanup Rewards',
      html: `
        <p>Click the link below to sign in. It expires in 24 hours.</p>
        <p><a href="${url}" style="color:#16a34a">Sign in to DeCleanup Rewards</a></p>
        <p style="color:#666;font-size:12px">If you did not request this, ignore this email.</p>
        <p style="color:#666;font-size:11px;word-break:break-all">${url}</p>
      `.trim(),
    }),
  })

  if (!res.ok) {
    const body = await res.text()
    let detail = body
    try {
      const json = JSON.parse(body) as { message?: string }
      if (json.message) detail = json.message
    } catch {
      /* use raw body */
    }
    throw new Error(`Resend API error (${res.status}): ${detail}`)
  }
}
