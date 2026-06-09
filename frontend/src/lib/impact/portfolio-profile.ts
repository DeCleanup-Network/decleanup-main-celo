import { isAddress, type Address } from 'viem'

export type EditableProfile = {
  displayName: string
  legalName: string
  bio: string
  locationLabel: string
  locationCoords: string
  showPreciseLocation: boolean
  impactContext: string
  additionalityStatement: string
  creatorName: string
  creatorRole: string
  projects: string
  openTo: string
  farcaster: string
  twitter: string
  dapp: string
}

export const PROFILE_LIMITS: Record<keyof Omit<EditableProfile, 'showPreciseLocation'>, number> = {
  displayName: 80,
  legalName: 120,
  bio: 420,
  locationLabel: 120,
  locationCoords: 64,
  impactContext: 600,
  additionalityStatement: 480,
  creatorName: 120,
  creatorRole: 140,
  projects: 420,
  openTo: 280,
  farcaster: 220,
  twitter: 220,
  dapp: 220,
}

/** Empty profile for new portfolios; no placeholder copy until the owner edits. */
export function emptyImpactProfile(): EditableProfile {
  return {
    displayName: '',
    legalName: '',
    bio: '',
    locationLabel: '',
    locationCoords: '',
    showPreciseLocation: false,
    impactContext: '',
    additionalityStatement: '',
    creatorName: '',
    creatorRole: '',
    projects: '',
    openTo: '',
    farcaster: '',
    twitter: '',
    dapp: '',
  }
}

/** Clamp user/API/localStorage profile fields without injecting marketing placeholder defaults. */
export function sanitizeProfileFromUserInput(input: unknown): EditableProfile {
  const base = emptyImpactProfile()
  const src = (input && typeof input === 'object' ? input : {}) as Partial<EditableProfile>
  return {
    displayName: clampField(src.displayName ?? base.displayName, PROFILE_LIMITS.displayName),
    legalName: clampField(src.legalName ?? base.legalName, PROFILE_LIMITS.legalName),
    bio: clampField(src.bio ?? base.bio, PROFILE_LIMITS.bio),
    locationLabel: clampField(src.locationLabel ?? base.locationLabel, PROFILE_LIMITS.locationLabel),
    locationCoords: clampField(src.locationCoords ?? base.locationCoords, PROFILE_LIMITS.locationCoords),
    showPreciseLocation: toBool(src.showPreciseLocation, base.showPreciseLocation),
    impactContext: clampField(src.impactContext ?? base.impactContext, PROFILE_LIMITS.impactContext),
    additionalityStatement: clampField(
      src.additionalityStatement ?? base.additionalityStatement,
      PROFILE_LIMITS.additionalityStatement
    ),
    creatorName: clampField(src.creatorName ?? base.creatorName, PROFILE_LIMITS.creatorName),
    creatorRole: clampField(src.creatorRole ?? base.creatorRole, PROFILE_LIMITS.creatorRole),
    projects: clampField(src.projects ?? base.projects, PROFILE_LIMITS.projects),
    openTo: clampField(src.openTo ?? base.openTo, PROFILE_LIMITS.openTo),
    farcaster: clampField(src.farcaster ?? base.farcaster, PROFILE_LIMITS.farcaster),
    twitter: clampField(src.twitter ?? base.twitter, PROFILE_LIMITS.twitter),
    dapp: clampField(src.dapp ?? base.dapp, PROFILE_LIMITS.dapp),
  }
}

export function getDefaultProfile(displayName: string): EditableProfile {
  return {
    displayName,
    legalName: 'Anastasia Boltrushevich',
    bio:
      'ReFi Phangan steward and DeCleanup co-founder based in Koh Phangan, Thailand. Building verifiable cleanup workflows and open impact disclosures. Open to partnerships and grant co-applicant opportunities.',
    locationLabel: 'Koh Phangan, Thailand, Surat Thani Province',
    locationCoords: '9.7317, 100.0136',
    showPreciseLocation: true,
    impactContext:
      'Koh Phangan has limited formal municipal waste collection in many zones, heavy tourist-season plastic load, and reef proximity. Documented cleanups here divert material that would otherwise persist in coastal buffers or enter nearshore habitat. This portfolio ties field activity to onchain verification for funders and CSR teams.',
    additionalityStatement:
      'Without these cleanups, collected material would likely remain in place or fragment further: informal dumping, beach and roadside accumulation, and storm-driven runoff toward coastal waters are common when collection is absent. Verified removal is additional to baseline municipal service in underserved zones.',
    creatorName: 'Anastasia Boltrushevich / Anastasia Lumina (Web3)',
    creatorRole: 'Community-first Product Manager · Vibe Coder · ReFi Builder',
    projects: 'DeCleanup Network, ReFi Phangan, Greenpill Phangan chapter, Khaima catering',
    openTo: 'Grant co-applicant, ESG consulting, ReFi partnerships, speaking invitations',
    farcaster: 'https://warpcast.com/~/channel/decleanup',
    twitter: 'https://x.com/decleanup_net',
    dapp: 'https://dapp.decleanup.net',
  }
}

function clampField(value: unknown, max: number): string {
  const v = typeof value === 'string' ? value.trim() : ''
  return v.slice(0, max)
}

function toBool(value: unknown, fallback = true): boolean {
  return typeof value === 'boolean' ? value : fallback
}

export function sanitizeProfile(input: unknown, fallbackDisplayName: string): EditableProfile {
  const src = (input && typeof input === 'object' ? input : {}) as Partial<EditableProfile>
  const defaults = getDefaultProfile(fallbackDisplayName)
  return {
    displayName: clampField(src.displayName ?? defaults.displayName, PROFILE_LIMITS.displayName),
    legalName: clampField(src.legalName ?? defaults.legalName, PROFILE_LIMITS.legalName),
    bio: clampField(src.bio ?? defaults.bio, PROFILE_LIMITS.bio),
    locationLabel: clampField(src.locationLabel ?? defaults.locationLabel, PROFILE_LIMITS.locationLabel),
    locationCoords: clampField(src.locationCoords ?? defaults.locationCoords, PROFILE_LIMITS.locationCoords),
    showPreciseLocation: toBool(src.showPreciseLocation, defaults.showPreciseLocation),
    impactContext: clampField(src.impactContext ?? defaults.impactContext, PROFILE_LIMITS.impactContext),
    additionalityStatement: clampField(
      src.additionalityStatement ?? defaults.additionalityStatement,
      PROFILE_LIMITS.additionalityStatement
    ),
    creatorName: clampField(src.creatorName ?? defaults.creatorName, PROFILE_LIMITS.creatorName),
    creatorRole: clampField(src.creatorRole ?? defaults.creatorRole, PROFILE_LIMITS.creatorRole),
    projects: clampField(src.projects ?? defaults.projects, PROFILE_LIMITS.projects),
    openTo: clampField(src.openTo ?? defaults.openTo, PROFILE_LIMITS.openTo),
    farcaster: clampField(src.farcaster ?? defaults.farcaster, PROFILE_LIMITS.farcaster),
    twitter: clampField(src.twitter ?? defaults.twitter, PROFILE_LIMITS.twitter),
    dapp: clampField(src.dapp ?? defaults.dapp, PROFILE_LIMITS.dapp),
  }
}

export function serializeProfile(profile: EditableProfile): string {
  return JSON.stringify({
    displayName: profile.displayName,
    legalName: profile.legalName,
    bio: profile.bio,
    locationLabel: profile.locationLabel,
    locationCoords: profile.locationCoords,
    showPreciseLocation: profile.showPreciseLocation,
    impactContext: profile.impactContext,
    additionalityStatement: profile.additionalityStatement,
    creatorName: profile.creatorName,
    creatorRole: profile.creatorRole,
    projects: profile.projects,
    openTo: profile.openTo,
    farcaster: profile.farcaster,
    twitter: profile.twitter,
    dapp: profile.dapp,
  })
}

export function buildProfileSignMessage(params: {
  address: Address
  profile: EditableProfile
  timestamp: number
}): string {
  return [
    'DeCleanup Impact Portfolio Profile Update',
    `Address: ${params.address.toLowerCase()}`,
    `Timestamp: ${params.timestamp}`,
    `Payload: ${serializeProfile(params.profile)}`,
  ].join('\n')
}

export function isValidPortfolioAddress(value: string): value is Address {
  return isAddress(value)
}
