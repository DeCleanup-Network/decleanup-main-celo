import type { HypercertRequest } from '../types'
import type { ImpactEntry } from '@/lib/impact/types'

export interface AtProtoPublishResult {
  success: boolean
  atUri?: string
  atCid?: string
  error?: string
}

export interface CleanupPhoto {
  cid: string
  type: 'before' | 'after' | 'recyclables' | 'evidence'
  mimeType: string
}

export interface AtProtoRecords {
  activity: OrgHypercertsClaimActivity.Record
  attachments: OrgHypercertsContextAttachment.Record[]
  measurements: OrgHypercertsContextMeasurement.Record[]
  evaluation?: OrgHypercertsContextEvaluation.Record
}

export interface PublishContext {
  request: HypercertRequest
  impactEntries: ImpactEntry[]
  photos: CleanupPhoto[]
  verifierDid: string
  orgDid: string
}
