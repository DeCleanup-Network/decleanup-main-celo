export const NOTIFICATION_TYPES = [
  'cleanup_verified',
  'cleanup_declined',
  'cleanup_submitted',
  'trash_athlete_verified',
  'trash_athlete_declined',
  'trash_athlete_rewards',
  'hypercert_success',
  'hypercert_fail',
  'referral_joined',
  'level_claimed',
  'streak_ending',
  'contributor_welcome',
  'contributor_listed',
  'passcode_expiring',
  'cleanup_pending_long',
  'airdrop_claimable',
  'endorsement_new',
] as const

export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** High-priority types shown as one-shot home modals until dismissed/read. */
export const PRIORITY_MODAL_TYPES: readonly NotificationType[] = [
  'contributor_welcome',
  'trash_athlete_verified',
  'trash_athlete_declined',
  'trash_athlete_rewards',
  'cleanup_declined',
  'cleanup_verified',
] as const

export type CreateNotificationInput = {
  userId: string
  type: NotificationType | string
  title: string
  body: string
  href?: string | null
  meta?: Record<string, unknown> | null
  /** Skip email even if user prefers it */
  skipEmail?: boolean
  /** Skip web push */
  skipPush?: boolean
  /** Skip inbox insert (rare) */
  skipInbox?: boolean
}

export type NotificationDto = {
  id: string
  type: string
  title: string
  body: string
  href: string | null
  meta: Record<string, unknown> | null
  readAt: string | null
  createdAt: string
}
