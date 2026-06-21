import type { HypercertRequest } from '../types'
import type { ImpactEntry } from '@/lib/impact/types'
import type { AtProtoRecords, CleanupPhoto, PublishContext } from './types'

/**
 * Builds a readable workScope string from the request metadata.
 * Uses work_scope.display_value (already formatted by metadata builder).
 */
function mapWorkScope(request: HypercertRequest): { scope: string; type: 'string' } {
  const metadata = request.metadata as any
  const hypercert = metadata.hypercert || {}
  const displayValue = hypercert.work_scope?.display_value

  if (displayValue) {
    return { scope: `Cleanup / ${displayValue}`, type: 'string' }
  }

  return { scope: 'Cleanup / Environmental cleanup', type: 'string' }
}

function mapContributors(orgDid: string): Array<{ identity: string; role: string }> {
  // Phase 1: only the org appears as contributor.
  // User wallets preserved in attachment metadata until IdentityLink is ready.
  return [{ identity: orgDid, role: 'issuer' }]
}

function mapAttachments(photos: CleanupPhoto[], metadataCid?: string): AtProtoRecords['attachments'] {
  const attachments: AtProtoRecords['attachments'] = photos.map((photo) => ({
    $type: 'org.hypercerts.context.attachment',
    contentType: photo.type === 'evidence' ? 'evidence' : 'report',
    title: `${photo.type} photo`,
    description: `${photo.type} photo from cleanup`,
    uri: `ipfs://${photo.cid}`,
    mimeType: photo.mimeType,
    createdAt: new Date().toISOString(),
  }))

  if (metadataCid) {
    attachments.push({
      $type: 'org.hypercerts.context.attachment',
      contentType: 'methodology',
      title: 'Hypercert metadata (IPFS)',
      description: 'Original ERC-1155 metadata JSON',
      uri: `ipfs://${metadataCid}`,
      mimeType: 'application/json',
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
      name: 'waste_collected_kg',
      value: totalWeightKg,
      unit: 'kg',
      description: 'Total waste collected',
      createdAt: new Date().toISOString(),
    })
  }

  const totalAreaSqm = entries.reduce((sum, e) => sum + (e.areaSqm || 0), 0)
  if (totalAreaSqm > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      name: 'area_cleaned_sqm',
      value: totalAreaSqm,
      unit: 'm²',
      description: 'Total cleaned area',
      createdAt: new Date().toISOString(),
    })
  }

  const totalBags = entries.reduce((sum, e) => sum + (e.bags || 0), 0)
  if (totalBags > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      name: 'bags_collected',
      value: totalBags,
      unit: 'bags',
      description: 'Total bags of waste',
      createdAt: new Date().toISOString(),
    })
  }

  const totalMinutes = entries.reduce((sum, e) => sum + (e.totalMinutes || 0), 0)
  if (totalMinutes > 0) {
    measurements.push({
      $type: 'org.hypercerts.context.measurement',
      name: 'total_time_minutes',
      value: totalMinutes,
      unit: 'minutes',
      description: 'Total cleanup time',
      createdAt: new Date().toISOString(),
    })
  }

  return measurements
}

function mapEvaluation(verifierDid: string, request: HypercertRequest): AtProtoRecords['evaluation'] {
  return {
    $type: 'org.hypercerts.context.evaluation',
    author: verifierDid,
    createdAt: new Date().toISOString(),
    status: 'approved',
    comments: 'Verified by DeCleanup Network',
    ...(request.metadataCid && { evidenceURI: [`ipfs://${request.metadataCid}`] }),
  }
}

export function mapToAtProtoRecords(context: PublishContext): AtProtoRecords {
  const { request, impactEntries, photos, orgDid, verifierDid } = context
  const metadata = request.metadata as any
  const hypercert = metadata.hypercert || {}

  // work_timeframe.value = [startMs, endMs] (HypercertDimension)
  const tf: number[] = hypercert.work_timeframe?.value || []
  const startDate = tf[0] ? new Date(tf[0]).toISOString() : new Date().toISOString()
  const endDate = tf[1] ? new Date(tf[1]).toISOString() : new Date().toISOString()

  const activity = {
    $type: 'org.hypercerts.claim.activity',
    title: metadata.name || 'DeCleanup Impact Certificate',
    shortDescription: metadata.description || 'Verified cleanup impact',
    createdAt: new Date().toISOString(),
    workScope: mapWorkScope(request),
    startDate,
    endDate,
    contributors: mapContributors(orgDid),
  }

  const attachments = mapAttachments(photos, request.metadataCid)
  const measurements = mapMeasurements(impactEntries)
  const evaluation = mapEvaluation(verifierDid, request)

  return { activity, attachments, measurements, evaluation }
}
