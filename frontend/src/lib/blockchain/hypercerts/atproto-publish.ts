import {
  getHypercertRequestById,
  recordAtProtoError,
  recordAtProtoEvidence,
} from '@/lib/supabase/hypercert-requests-db'
import {
  getCleanupPhotosBySubmissionId,
  getImpactEntriesByRequestId,
} from '@/lib/impact/queries'
import { mapToAtProtoRecords } from './atproto/mapper'
import {
  publishActivity,
  publishAttachment,
  publishEvaluation,
  publishMeasurement,
  toStrongRef,
  type StrongRef,
} from './atproto/client'
import { getAtProtoOrgDid, isAtProtoEnabled } from './config'
import type { AtProtoPublishResult } from './atproto/types'
import type { CleanupPhoto } from './atproto/types'

export async function publishHypercertToAtProto(
  requestId: string,
  verifierDid?: string,
): Promise<AtProtoPublishResult> {
  if (!isAtProtoEnabled()) {
    return { success: false, error: 'ATProto publishing is disabled' }
  }

  try {
    // 1. Fetch request
    const request = await getHypercertRequestById(requestId)
    if (!request) {
      return { success: false, error: `Request ${requestId} not found` }
    }

    if (request.status !== 'APPROVED') {
      return { success: false, error: `Request ${requestId} is not approved` }
    }

    // Idempotency: if already published, return existing
    if (request.at_uri) {
      return { success: true, atUri: request.at_uri, atCid: request.at_cid }
    }

    // 2. Fetch impact entries and photos
    const impactEntries = await getImpactEntriesByRequestId(requestId)
    const photos: CleanupPhoto[] = []
    for (const entry of impactEntries) {
      const entryPhotos = await getCleanupPhotosBySubmissionId(entry.submissionId)
      photos.push(...entryPhotos)
    }

    // 3. Map to AT records
    const orgDid = getAtProtoOrgDid()
    const finalVerifierDid = verifierDid || orgDid

    const records = mapToAtProtoRecords({
      request,
      impactEntries,
      photos,
      orgDid,
      verifierDid: finalVerifierDid,
    })

    // 4. Publish activity first (required, gates the rest)
    const { uri: activityUri, cid: activityCid } = await publishActivity(records.activity)
    const activityRef: StrongRef = toStrongRef(activityUri, activityCid)

    // 5. Publish attachments (best-effort)
    for (const attachment of records.attachments) {
      try {
        await publishAttachment(attachment, activityRef)
      } catch (err) {
        console.error(`[ATProto] Attachment publish failed: ${err}`)
      }
    }

    // 6. Publish measurements (best-effort)
    for (const measurement of records.measurements) {
      try {
        await publishMeasurement(measurement, activityRef)
      } catch (err) {
        console.error(`[ATProto] Measurement publish failed: ${err}`)
      }
    }

    // 7. Publish evaluation (best-effort)
    if (records.evaluation) {
      try {
        await publishEvaluation(records.evaluation, activityRef)
      } catch (err) {
        console.error(`[ATProto] Evaluation publish failed: ${err}`)
      }
    }

    // 8. Save to Supabase
    await recordAtProtoEvidence(requestId, { atUri: activityUri, atCid: activityCid })

    return { success: true, atUri: activityUri, atCid: activityCid }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)
    await recordAtProtoError(requestId, errorMessage)
    return { success: false, error: errorMessage }
  }
}
