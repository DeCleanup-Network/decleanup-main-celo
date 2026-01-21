import { HypercertMetadataInput } from './types'
import { buildHypercertMetadata } from './metadata'

export async function mintHypercertAsVerifier(params: {
  verifierAddress: string
  metadata: HypercertMetadataInput
}) {
  // v1 intentionally manual / script-based
  const metadataPayload = buildHypercertMetadata(params.metadata)

  return {
    mintedBy: params.verifierAddress,
    metadata: metadataPayload,
    timestamp: Date.now(),
  }
}