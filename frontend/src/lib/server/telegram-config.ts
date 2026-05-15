/**
 * Server-only Telegram bot configuration for verifier alerts.
 */

export type TelegramConfig = {
  botToken: string
  verifierChatId: string
  appBaseUrl: string
  blockExplorerUrl: string
}

export function getTelegramConfig(): TelegramConfig | null {
  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim()
  const verifierChatId = process.env.TELEGRAM_VERIFIER_CHAT_ID?.trim()
  if (!botToken || !verifierChatId) return null

  const appBaseUrl = (
    process.env.NEXT_PUBLIC_WEB_APP_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.PUBLIC_URL_BASE ||
    'https://dapp.decleanup.net'
  ).replace(/\/$/, '')

  const blockExplorerUrl = (
    process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL || 'https://celoscan.io'
  ).replace(/\/$/, '')

  return { botToken, verifierChatId, appBaseUrl, blockExplorerUrl }
}

export function isTelegramNotifierConfigured(): boolean {
  return getTelegramConfig() !== null
}
