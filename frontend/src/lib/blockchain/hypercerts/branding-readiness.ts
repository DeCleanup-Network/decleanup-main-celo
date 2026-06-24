/** DeCleanup minimums before submit — stricter than AT lexicon required fields alone. */
export const HYPERCERT_BRANDING_MIN_TITLE = 3
export const HYPERCERT_BRANDING_MIN_DESCRIPTION = 20

/** AT `org.hypercerts.claim.activity` lexicon limits. */
export const HYPERCERT_BRANDING_MAX_TITLE = 256
export const HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES = 300

export type BrandingDraft = {
  title: string
  description: string
  logoImageCid?: string
  bannerImageCid?: string
}

export type BrandingCheck = {
  id: 'title' | 'description' | 'image'
  label: string
  ok: boolean
}

export type BrandingReadiness = {
  ready: boolean
  checks: BrandingCheck[]
  /** Shown when Request is disabled due to branding only. */
  hint?: string
}

export function countGraphemes(value: string): number {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    return [...segmenter.segment(value)].length
  }
  return [...value].length
}

export function clampHypercertTitle(value: string): string {
  return value.slice(0, HYPERCERT_BRANDING_MAX_TITLE)
}

export function clampHypercertDescription(value: string): string {
  if (typeof Intl !== 'undefined' && 'Segmenter' in Intl) {
    const segmenter = new Intl.Segmenter(undefined, { granularity: 'grapheme' })
    const segments = [...segmenter.segment(value)]
    if (segments.length <= HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES) return value
    return segments
      .slice(0, HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES)
      .map((part) => part.segment)
      .join('')
  }
  return value.slice(0, HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES)
}

export function isHypercertTitleWithinLimit(title: string): boolean {
  return title.length <= HYPERCERT_BRANDING_MAX_TITLE
}

export function isHypercertDescriptionWithinLimit(description: string): boolean {
  return countGraphemes(description) <= HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES
}

/** Server/client guard before submit. Returns a user-facing error or null. */
export function getBrandingLengthError(draft: Pick<BrandingDraft, 'title' | 'description'>): string | null {
  const title = draft.title.trim()
  const description = draft.description.trim()

  if (title.length < HYPERCERT_BRANDING_MIN_TITLE) {
    return `Title must be at least ${HYPERCERT_BRANDING_MIN_TITLE} characters.`
  }
  if (!isHypercertTitleWithinLimit(title)) {
    return `Title must be ${HYPERCERT_BRANDING_MAX_TITLE} characters or fewer.`
  }
  if (countGraphemes(description) < HYPERCERT_BRANDING_MIN_DESCRIPTION) {
    return `Description must be at least ${HYPERCERT_BRANDING_MIN_DESCRIPTION} characters.`
  }
  if (!isHypercertDescriptionWithinLimit(description)) {
    return `Description must be ${HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES} characters or fewer.`
  }
  return null
}

/**
 * AT `org.hypercerts.claim.activity` requires title + shortDescription + createdAt.
 * Image is optional on-chain but required here so Hyperscan / portfolio show a real cover.
 * Logo OR banner on IPFS is enough (maps to activity.image + attachments).
 */
export function evaluateBrandingReadiness(draft: BrandingDraft): BrandingReadiness {
  const title = draft.title.trim()
  const description = draft.description.trim()
  const titleOk =
    title.length >= HYPERCERT_BRANDING_MIN_TITLE && isHypercertTitleWithinLimit(title)
  const descriptionOk =
    countGraphemes(description) >= HYPERCERT_BRANDING_MIN_DESCRIPTION &&
    isHypercertDescriptionWithinLimit(description)
  const imageOk = Boolean(draft.logoImageCid || draft.bannerImageCid)

  const checks: BrandingCheck[] = [
    {
      id: 'title',
      label: `Title (${HYPERCERT_BRANDING_MIN_TITLE}–${HYPERCERT_BRANDING_MAX_TITLE})`,
      ok: titleOk,
    },
    {
      id: 'description',
      label: `Description (${HYPERCERT_BRANDING_MIN_DESCRIPTION}–${HYPERCERT_BRANDING_MAX_DESCRIPTION_GRAPHEMES})`,
      ok: descriptionOk,
    },
    { id: 'image', label: 'Cover image', ok: imageOk },
  ]

  const ready = titleOk && descriptionOk && imageOk
  let hint: string | undefined
  if (!ready) {
    const missing = checks.filter((c) => !c.ok).map((c) => c.label.toLowerCase())
    hint = `Complete certificate details above first: ${missing.join(', ')}.`
  }

  return { ready, checks, hint }
}
