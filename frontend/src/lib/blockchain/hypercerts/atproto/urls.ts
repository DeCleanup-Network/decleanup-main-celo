/**
 * Human-friendly Hypercerts viewer (activity + attachments).
 * @see https://www.hyperscan.dev/data
 */
export function buildHyperscanDataExplorerUrl(atUri: string): string | null {
  const match = /^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/.exec(atUri.trim())
  if (!match) return null
  const [, did, collection, rkey] = match
  const params = new URLSearchParams({ did, collection, rkey })
  return `https://www.hyperscan.dev/data?${params.toString()}`
}

/** Legacy / alternate Hyperscan route. */
export function buildHyperscanHypercertUrl(atUri: string): string {
  const dataUrl = buildHyperscanDataExplorerUrl(atUri)
  if (dataUrl) return dataUrl
  return `https://hyperscan.org/hypercert/${encodeURIComponent(atUri)}`
}
