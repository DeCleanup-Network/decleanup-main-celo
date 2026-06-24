/** DeCleanup minimums before submit — stricter than AT lexicon required fields alone. */
export const HYPERCERT_BRANDING_MIN_TITLE = 3
export const HYPERCERT_BRANDING_MIN_DESCRIPTION = 20

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

/**
 * AT `org.hypercerts.claim.activity` requires title + shortDescription + createdAt.
 * Image is optional on-chain but required here so Hyperscan / portfolio show a real cover.
 * Logo OR banner on IPFS is enough (maps to activity.image + attachments).
 */
export function evaluateBrandingReadiness(draft: BrandingDraft): BrandingReadiness {
  const title = draft.title.trim()
  const description = draft.description.trim()
  const titleOk = title.length >= HYPERCERT_BRANDING_MIN_TITLE
  const descriptionOk = description.length >= HYPERCERT_BRANDING_MIN_DESCRIPTION
  const imageOk = Boolean(draft.logoImageCid || draft.bannerImageCid)

  const checks: BrandingCheck[] = [
    { id: 'title', label: 'Title', ok: titleOk },
    { id: 'description', label: 'Description', ok: descriptionOk },
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
