/**
 * Which cleanup photos may appear on the public landing feed.
 * Permissions come from the impact report JSON on IPFS (checkboxes + Hypercerts rights preset).
 */

import { allowsPublicFeedPhotos } from '@/lib/blockchain/hypercerts/rights-presets'

export type ImpactReportPhotoPermissions = {
  rightsAssignment?: string
  beforePhotoAllowed?: boolean
  afterPhotoAllowed?: boolean
}

export {
  formatRightsAssignment,
  allowsPublicFeedPhotos,
  HYPERCERT_RIGHTS_PRESETS,
  type HypercertRightsPresetId,
} from '@/lib/blockchain/hypercerts/rights-presets'

export function parseImpactReportPhotoPermissions(
  raw: unknown
): ImpactReportPhotoPermissions | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  return {
    rightsAssignment:
      typeof o.rightsAssignment === 'string' ? o.rightsAssignment : undefined,
    beforePhotoAllowed: o.beforePhotoAllowed === true,
    afterPhotoAllowed: o.afterPhotoAllowed === true,
  }
}

export function applyPublicFeedPhotoCids(params: {
  beforePhotoCid: string
  afterPhotoCid: string
  recyclablesPhotoCid: string
  recyclablesReceiptCid: string
  permissions: ImpactReportPhotoPermissions | null
}): {
  before_photo_cid: string
  after_photo_cid: string
  recyclables_photo_cid: string
  recyclables_receipt_cid: string
} {
  const { permissions } = params
  if (!permissions || !allowsPublicFeedPhotos(permissions.rightsAssignment)) {
    return {
      before_photo_cid: '',
      after_photo_cid: '',
      recyclables_photo_cid: '',
      recyclables_receipt_cid: '',
    }
  }

  return {
    before_photo_cid: permissions.beforePhotoAllowed ? params.beforePhotoCid : '',
    after_photo_cid: permissions.afterPhotoAllowed ? params.afterPhotoCid : '',
    recyclables_photo_cid: params.recyclablesPhotoCid,
    recyclables_receipt_cid: params.recyclablesReceiptCid,
  }
}
