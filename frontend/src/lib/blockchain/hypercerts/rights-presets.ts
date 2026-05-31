import type { HypercertDimension } from './types'

/**
 * Hypercerts require a `rights` dimension on impact certificates.
 * DeCleanup exposes the five standard preset choices as a single required field.
 */
export type HypercertRightsPresetId =
  | 'all-rights-reserved'
  | 'public-display'
  | 'public-display-non-commercial'
  | 'public-display-commercial'
  | 'public-display-commercial-derivatives'

export type HypercertRightsPreset = {
  id: HypercertRightsPresetId
  /** Short label for the impact report dropdown */
  label: string
  /** Plain note shown under the field — maps to hypercert.rights */
  hypercertNote: string
  rightsValue: string[]
  displayValue: string
  allowsPublicFeedPhotos: boolean
}

export const HYPERCERT_RIGHTS_PRESETS: readonly HypercertRightsPreset[] = [
  {
    id: 'all-rights-reserved',
    label: 'Keep photos private',
    hypercertNote: 'All Rights Reserved',
    rightsValue: [],
    displayValue: 'All Rights Reserved',
    allowsPublicFeedPhotos: false,
  },
  {
    id: 'public-display',
    label: 'Public display, no reuse',
    hypercertNote: 'Public Display',
    rightsValue: ['Public Display'],
    displayValue: 'Public Display',
    allowsPublicFeedPhotos: true,
  },
  {
    id: 'public-display-non-commercial',
    label: 'Public display, non-commercial reuse',
    hypercertNote: 'Public Display + Non-Commercial Use Only',
    rightsValue: ['Public Display', 'Non-Commercial Use Only'],
    displayValue: 'Public Display + Non-Commercial Use Only',
    allowsPublicFeedPhotos: true,
  },
  {
    id: 'public-display-commercial',
    label: 'Public display, commercial reuse',
    hypercertNote: 'Public Display + Commercial Use',
    rightsValue: ['Public Display', 'Commercial Use'],
    displayValue: 'Public Display + Commercial Use',
    allowsPublicFeedPhotos: true,
  },
  {
    id: 'public-display-commercial-derivatives',
    label: 'Public display, commercial reuse and edits',
    hypercertNote: 'Public Display + Commercial Use + Create Derivatives',
    rightsValue: ['Public Display', 'Commercial Use', 'Create Derivatives'],
    displayValue: 'Public Display + Commercial Use + Create Derivatives',
    allowsPublicFeedPhotos: true,
  },
] as const

const PRESET_BY_ID = new Map(HYPERCERT_RIGHTS_PRESETS.map((p) => [p.id, p]))

/** Legacy CC-style values from earlier impact report forms. */
const LEGACY_TO_PRESET: Record<string, HypercertRightsPresetId> = {
  'all-rights-reserved': 'all-rights-reserved',
  attribution: 'public-display-commercial-derivatives',
  'non-commercial': 'public-display-non-commercial',
  'no-derivatives': 'public-display-commercial',
  'share-alike': 'public-display-commercial-derivatives',
}

export function resolveHypercertRightsPreset(
  rightsAssignment: string | undefined | null
): HypercertRightsPreset | null {
  if (!rightsAssignment?.trim()) return null
  const raw = rightsAssignment.trim()
  const id = (PRESET_BY_ID.has(raw as HypercertRightsPresetId)
    ? raw
    : LEGACY_TO_PRESET[raw]) as HypercertRightsPresetId | undefined
  if (!id) return null
  return PRESET_BY_ID.get(id) ?? null
}

export function formatRightsAssignment(value: string | undefined | null): string {
  const preset = resolveHypercertRightsPreset(value)
  if (preset) return `${preset.label} (${preset.hypercertNote})`
  return value ?? ''
}

export function allowsPublicFeedPhotos(rightsAssignment: string | undefined | null): boolean {
  const preset = resolveHypercertRightsPreset(rightsAssignment)
  return preset?.allowsPublicFeedPhotos ?? false
}

export function buildHypercertRightsDimension(
  rightsAssignment: string | undefined | null
): HypercertDimension<string> {
  const preset = resolveHypercertRightsPreset(rightsAssignment)
  if (!preset) {
    return {
      name: 'Rights',
      value: [],
      excludes: [],
      display_value: 'All Rights Reserved',
    }
  }
  return {
    name: 'Rights',
    value: preset.rightsValue,
    excludes: [],
    display_value: preset.displayValue,
  }
}
