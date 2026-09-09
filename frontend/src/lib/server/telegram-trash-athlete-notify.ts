import 'server-only'
import {
  TRASH_ATHLETE_BONUS_CDCU,
  TRASH_ATHLETE_DCU_POINTS,
  TRASH_ATHLETE_LABEL,
  TRASH_ATHLETE_TARGET_LEVEL,
} from '@/lib/trash-athlete/constants'
import type { TrashAthleteChallenge } from '@/lib/trash-athlete/types'
import { getTelegramConfig } from '@/lib/server/telegram-config'
import { sendTelegramMessage } from '@/lib/server/telegram-client'
import {
  markSubmissionTelegramNotified,
  wasSubmissionTelegramNotified,
} from '@/lib/server/telegram-notification-log'

/** Prefix so Trash Athlete IDs never collide with numeric cleanup submission IDs. */
export function trashAthleteTelegramNotifyKey(challengeId: string): string {
  return `ta:${challengeId}`
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
}

function shortAddress(addr: string): string {
  if (addr.length < 12) return addr
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`
}

export type NotifyTrashAthleteResult =
  | { sent: true; messageId: number }
  | {
      sent: false
      reason: 'not_configured' | 'already_notified' | 'not_pending' | 'telegram_error'
      detail?: string
    }

/**
 * Alert verifiers that a new Trash Athlete Challenge was submitted (off-chain).
 */
export async function notifyVerifiersOfTrashAthleteChallenge(
  challenge: TrashAthleteChallenge
): Promise<NotifyTrashAthleteResult> {
  const config = getTelegramConfig()
  if (!config) {
    return { sent: false, reason: 'not_configured' }
  }

  if (challenge.status !== 'PENDING') {
    return { sent: false, reason: 'not_pending' }
  }

  const notifyKey = trashAthleteTelegramNotifyKey(challenge.id)
  if (await wasSubmissionTelegramNotified(notifyKey)) {
    return { sent: false, reason: 'already_notified' }
  }

  const submittedAt = new Date(challenge.submittedAt).toISOString()
  const socialUrl = challenge.socialProfileUrl.trim()
  const notes = (challenge.notes || '').trim()

  const lines = [
    `🏃 <b>New ${escapeHtml(TRASH_ATHLETE_LABEL)}</b>`,
    '',
    `<b>ID:</b> <code>${escapeHtml(challenge.id)}</code>`,
    `<b>Username:</b> ${escapeHtml(challenge.username)}`,
    `<b>Signer:</b> <code>${escapeHtml(challenge.walletAddress)}</code> (${shortAddress(challenge.walletAddress)})`,
  ]

  if (challenge.email) {
    lines.push(`<b>Email:</b> ${escapeHtml(challenge.email)}`)
  }

  lines.push(
    `<b>When:</b> ${escapeHtml(submittedAt)}`,
    '',
    `<a href="${escapeHtml(socialUrl)}">Open social link</a>`,
    `<b>Reward package:</b> level ${TRASH_ATHLETE_TARGET_LEVEL} + ${TRASH_ATHLETE_DCU_POINTS} DCU + ${TRASH_ATHLETE_BONUS_CDCU} $cDCU`
  )

  if (notes) {
    lines.push('', `<b>Notes:</b> ${escapeHtml(notes.slice(0, 500))}${notes.length > 500 ? '…' : ''}`)
  }

  lines.push(
    '',
    `<a href="${config.appBaseUrl}/verifier">Open verifier dashboard</a>`,
    `<a href="${config.appBaseUrl}/cleanup/trash-athlete">Trash Athlete page</a>`
  )

  const result = await sendTelegramMessage({
    botToken: config.botToken,
    chatId: config.verifierChatId,
    text: lines.join('\n'),
    disableWebPagePreview: false,
  })

  if (!result.ok) {
    console.error('[telegram-trash-athlete-notify] send failed:', result.error)
    return { sent: false, reason: 'telegram_error', detail: result.error }
  }

  await markSubmissionTelegramNotified(notifyKey)

  return { sent: true, messageId: result.messageId }
}
