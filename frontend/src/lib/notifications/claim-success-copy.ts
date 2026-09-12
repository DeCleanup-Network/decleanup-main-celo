/** User-facing copy after Impact Product mint/upgrade claim. */
export function buildImpactProductClaimMessage(opts: {
  nftAction?: 'minted' | 'upgraded' | null
  /** Used when nftAction is null — level before claim (>0 ⇒ upgraded). */
  priorLevel?: number
  hasImpactReport?: boolean
  hasRecyclables?: boolean
  bonusError?: string
  /** Null/empty means no mint/upgrade tx ran in this claim. */
  nftTxHash?: `0x${string}` | null
}): string {
  const nftVerb =
    opts.nftAction === 'upgraded'
      ? 'upgraded'
      : opts.nftAction === 'minted'
        ? 'minted'
        : (opts.priorLevel ?? 0) > 0
          ? 'upgraded'
          : 'minted'

  let message = `Your Impact Product was ${nftVerb}.`

  const reportParts: string[] = []
  if (opts.hasRecyclables) reportParts.push('recyclables report')
  if (opts.hasImpactReport) reportParts.push('impact report')
  if (reportParts.length === 1) {
    message += ` Additional reward will be granted for submitting ${reportParts[0]}.`
  } else if (reportParts.length === 2) {
    message += ` Additional reward will be granted for submitting ${reportParts[0]} and ${reportParts[1]}.`
  }

  if (opts.bonusError) {
    message +=
      ' Recyclables / impact-report DCU did not land yet (bonus step failed after NFT). Tap Claim again to retry bonuses only, or refresh in a minute.'
  } else if (!opts.nftTxHash) {
    message += ' No new NFT step was required; refresh your dashboard balances.'
  }

  return message
}

export function impactProductNftVerb(opts: {
  nftAction?: 'minted' | 'upgraded' | null
  priorLevel?: number
}): 'minted' | 'upgraded' {
  if (opts.nftAction === 'upgraded' || opts.nftAction === 'minted') return opts.nftAction
  return (opts.priorLevel ?? 0) > 0 ? 'upgraded' : 'minted'
}
