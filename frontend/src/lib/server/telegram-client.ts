import 'server-only'

/**
 * Low-level Telegram Bot API client (sendMessage only).
 */

export async function sendTelegramMessage(params: {
  botToken: string
  chatId: string
  text: string
  disableWebPagePreview?: boolean
}): Promise<{ ok: true; messageId: number } | { ok: false; error: string }> {
  const url = `https://api.telegram.org/bot${params.botToken}/sendMessage`
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: params.chatId,
      text: params.text,
      parse_mode: 'HTML',
      disable_web_page_preview: params.disableWebPagePreview ?? false,
    }),
  })

  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean
    description?: string
    result?: { message_id?: number }
  }

  if (!res.ok || !data.ok) {
    return {
      ok: false,
      error: data.description || `Telegram API HTTP ${res.status}`,
    }
  }

  return { ok: true, messageId: data.result?.message_id ?? 0 }
}
