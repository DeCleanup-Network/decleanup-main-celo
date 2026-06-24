import type { HypercertRequest, HypercertBranding } from '../types'
import type { ImpactEntry } from '@/lib/impact/types'
import type { AtProtoRecords, CleanupPhoto, PublishContext } from './types'

const WORK_SCOPE_STRING = 'org.hypercerts.claim.activity#workScopeString'
const CONTRIBUTOR_IDENTITY = 'org.hypercerts.claim.activity#contributorIdentity'
const CONTRIBUTOR_ROLE = 'org.hypercerts.claim.activity#contributorRole'
const DEFS_URI = 'org.hypercerts.defs#uri'
const CERTIFIED_DID = 'app.certified.defs#did'

function defsUri(uri: string) {
  return { $type: DEFS_URI, uri }
}

function certifiedDid(did: string) {
  return { $type: CERTIFIED_DID, did }
}

/**
 * Builds a readable workScope string from the request metadata.
 * Uses work_scope.display_value (already formatted by metadata builder).
 */
function mapWorkScope(request: HypercertRequest) {
  const metadata = request.metadata as unknown as Record<string, unknown>
  const hypercert = (metadata.hypercert || {}) as Record<string, unknown>
  const workScope = hypercert.work_scope as { display_value?: string } | undefined
  const displayValue = workScope?.display_value

  const scope = displayValue
    ? `Cleanup / ${displayValue}`
    : 'Cleanup / Environmental cleanup'

  return { $type: WORK_SCOPE_STRING, scope }
}

function mapContributors(orgDid: string) {
  return [
    {
      contributorIdentity: { $type: CONTRIBUTOR_IDENTITY, identity: orgDid },
      contributionDetails: { $type: CONTRIBUTOR_ROLE, role: 'issuer' },
    },
  ]
}

function resolveActivityImage(metadata: Record<string, unknown>): string | undefined {
  const branding = metadata.branding as
    | { bannerImageCid?: string; logoImageCid?: string }
    | undefined

  const bannerCid = branding?.bannerImageCid
  if (bannerCid) return `ipfs://${bannerCid}`

  const logoCid = branding?.logoImageCid
  if (logoCid) return `ipfs://${logoCid}`

  const image = metadata.image
  if (typeof image === 'string' && image.startsWith('ipfs://')) {
    return image
  }

  return undefined
}

function mapAttachments(
  photos: CleanupPhoto[],
  metadataCid?: string,
  branding?: HypercertBranding
): AtProtoRecords['attachments'] {
  const attachments: AtProtoRecords['attachments'] = photos.map((photo) => ({
    $type: 'org.hypercerts.context.attachment',
    contentType: photo.type === 'evidence' ? 'evidence' : 'report',
    title: `${photo.type} photo`,
    shortDescription: `${photo.type} photo from cleanup`,
    content: [defsUri(`ipfs://${photo.cid}`)],
    createdAt: new Date().toISOString(),
  }))

  if (branding?.bannerImageCid) {
    attachments.push({
      $type: 'org.hypercerts.context.attachment',
      contentType: 'report',
      title: 'Certificate banner',
      shortDescription: 'Hypercert branding banner',
      content: [defsUri(`ipfs://${branding.bannerImageCid}`)],
      createdAt: new Date().toISOString(),
    })
  }

  if (branding?.logoImageCid) {
    attachments.push({
      $type: 'org.hypercerts.context.attachment',
      contentType: 'report',
      title: 'Certificate logo',
      shortDescription: 'Hypercert branding logo',
      content: [defsUri(`ipfs://${branding.logoImageCid}`)],
      createdAt: new Date().toISOString(),
    })
  }

  if (metadataCid) {
    attachments.push({
      $type: 'org.hypercerts.context.attachment',
      contentType: 'methodology',
      title: 'Hypercert metadata (IPFS)',
      shortDescription: 'Original ERC-1155 metadata JSON',
      content: [defsUri(`ipfs://${metadataCid}`)],
      createdAt: new Date().toISOString(),
    })
  }

  return attachments
}

function mapMeasurements(entries: ImpactEntry[]): AtProtoRecords['measurements'] {
  const measurements: AtProtoRecords['measurements'] = []

  const totalWeightKg = entries.reduce((sum, e) => sum + (e.weightKg || 0), 0)
  if (totalWeightKg > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      metric: 'waste_collected_kg',
      value: String(totalWeightKg),
      unit: 'kg',
      comment: 'Total waste collected',
      createdAt: new Date().toISOString(),
    })
  }

  const totalAreaSqm = entries.reduce((sum, e) => sum + (e.areaSqm || 0), 0)
  if (totalAreaSqm > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      metric: 'area_cleaned_sqm',
      value: String(totalAreaSqm),
      unit: 'm²',
      comment: 'Total cleaned area',
      createdAt: new Date().toISOString(),
    })
  }

  const totalBags = entries.reduce((sum, e) => sum + (e.bags || 0), 0)
  if (totalBags > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      metric: 'bags_collected',
      value: String(totalBags),
      unit: 'bags',
      comment: 'Total bags of waste',
      createdAt: new Date().toISOString(),
    })
  }

  const totalMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes || 0), 0)
  if (totalMinutes > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      metric: 'total_time_minutes',
      value: String(totalMinutes),
      unit: 'minutes',
      comment: 'Total cleanup time',
      createdAt: new Date().toISOString(),
    })
  }

  return measurements
}

function mapEvaluation(verifierDid: string, request: HypercertRequest): AtProtoRecords['evaluation'] {
  return {
    $type: 'org.hypercerts.context.evaluation',
    evaluators: [certifiedDid(verifierDid)],
    summary: 'Verified by DeCleanup Network',
    createdAt: new Date().toISOString(),
    ...(request.metadataCid
      ? { content: [defsUri(`ipfs://${request.metadataCid}`)] }
      : {}),
  }
}

export function mapToAtProtoRecords(context: PublishContext): AtProtoRecords {
  const { request, impactEntries, photos, orgDid, verifierDid } = context
  const metadata = request.metadata as unknown as Record<string, unknown>
  const hypercert = (metadata.hypercert || {}) as Record<string, unknown>

  // work_timeframe.value = [startMs, endMs] (HypercertDimension)
  const tf = (hypercert.work_timeframe as { value?: number[] } | undefined)?.value || []
  const startDate = tf[0] ? new Date(tf[0]).toISOString() : new Date().toISOString()
  const endDate = tf[1] ? new Date(tf[1]).toISOString() : new Date().toISOString()

  const branding = metadata.branding as HypercertBranding | undefined
  const activityImage = resolveActivityImage(metadata)

  const activity = {
    $type: 'org.hypercerts.claim.activity',
    title:
      (typeof metadata.name === 'string' && metadata.name) ||
      branding?.title ||
      'DeCleanup Impact Certificate',
    shortDescription:
      (typeof metadata.description === 'string' && metadata.description) ||
      branding?.description ||
      'Verified cleanup impact',
    createdAt: new Date().toISOString(),
    workScope: mapWorkScope(request),
    startDate,
    endDate,
    contributors: mapContributors(orgDid),
    ...(activityImage ? { image: defsUri(activityImage) } : {}),
  }

  const attachments = mapAttachments(photos, request.metadataCid, branding)
  const measurements = mapMeasurements(impactEntries)
  const evaluation = mapEvaluation(verifierDid, request)

  return { activity, attachments, measurements, evaluation }
}
