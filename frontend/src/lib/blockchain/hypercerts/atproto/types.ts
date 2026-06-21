import type {
  OrgHypercertsClaimActivity,
  OrgHypercertsContextAttachment,
  OrgHypercertsContextMeasurement,
  OrgHypercertsContextEvaluation,
} from '@hypercerts-org/lexicon'
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export interface AtProtoRecords {
  activity: Record<string, any>
  attachments: Record<string, any>[]
  measurements: Record<string, any>[]
  evaluation?: Record<string, any>
}

export interface PublishContext {
  request: HypercertRequest
  impactEntries: ImpactEntry[]
  photos: CleanupPhoto[]
  verifierDid: string
  orgDid: string
}
