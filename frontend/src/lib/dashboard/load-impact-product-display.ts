import {
  getTokenURI,
  getTokenURIForLevel,
} from '@/lib/blockchain/contracts'
import { fetchViaIpfsGatewayProxy } from '@/lib/utils/ipfs-gateway-proxy'

interface ImpactAttribute {
  trait_type?: string
  value?: string | number
}

interface ImpactMetadata {
  name?: string
  description?: string
  external_url?: string
  image?: string
  animation_url?: string
  attributes?: ImpactAttribute[]
}

export type ImpactProductDisplayState = {
  level: number
  imageUrl: string
  animationUrl: string
  tokenId: bigint | null
  metadataName: string | null
  metadataDescription: string | null
  metadataExternalUrl: string | null
  metadataAttributes: { trait_type: string; value: string }[]
}

function convertIPFSToGateway(ipfsUrl: string): string {
  if (!ipfsUrl.startsWith('ipfs://')) {
    return ipfsUrl
  }
  let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
  if (path.startsWith('/')) path = path.substring(1)
  return `https://ipfs.io/ipfs/${path}`
}

async function fetchWithFallback(ipfsUrl: string): Promise<Response> {
  const jsonHeaders = { Accept: 'application/json' }

  if (!ipfsUrl.startsWith('ipfs://')) {
    return fetchViaIpfsGatewayProxy(ipfsUrl, {
      method: 'GET',
      headers: jsonHeaders,
      redirect: 'follow',
    })
  }

  const gateways = [
    'https://ipfs.io/ipfs/',
    process.env.NEXT_PUBLIC_IPFS_GATEWAY || 'https://gateway.pinata.cloud/ipfs/',
    'https://cloudflare-ipfs.com/ipfs/',
    'https://dweb.link/ipfs/',
  ]

  let path = ipfsUrl.replace('ipfs://', '').replace(/\/+/g, '/')
  if (path.startsWith('/')) path = path.substring(1)

  for (const gateway of gateways) {
    try {
      const url = `${gateway}${path}`
      const response = await fetchViaIpfsGatewayProxy(url, {
        method: 'GET',
        headers: jsonHeaders,
        redirect: 'follow',
      })
      if (response.ok) return response
    } catch (error) {
      console.warn(`Gateway ${gateway} failed:`, error)
    }
  }

  throw new Error(`All IPFS gateways failed for: ${ipfsUrl}`)
}

async function parseMetadataJsonFromResponse(res: Response): Promise<ImpactMetadata> {
  const text = await res.text()
  if (text.trim().startsWith('<')) {
    throw new Error('Metadata URL returned HTML instead of JSON')
  }
  return JSON.parse(text) as ImpactMetadata
}

/** Load Impact Product image/metadata; prefers tokenId-based URI when minted. */
export async function loadImpactProductDisplay(
  level: number,
  tokenId: bigint | null
): Promise<ImpactProductDisplayState> {
  const emptyExtras = {
    metadataName: null as string | null,
    metadataDescription: null as string | null,
    metadataExternalUrl: null as string | null,
    metadataAttributes: [] as { trait_type: string; value: string }[],
  }
  if (level <= 0) {
    return {
      level: 0,
      imageUrl: '',
      animationUrl: '',
      tokenId: null,
      ...emptyExtras,
    }
  }

  let metadataName: string | null = null
  let metadataDescription: string | null = null
  let metadataExternalUrl: string | null = null
  let metadataAttributes: { trait_type: string; value: string }[] = []

  try {
    let tokenURI = ''
    if (tokenId !== null) {
      tokenURI = await getTokenURI(tokenId)
    }
    if (!tokenURI) {
      tokenURI = await getTokenURIForLevel(level)
    }
    let imageUrl = ''
    let animationUrl = ''

    if (tokenURI) {
      try {
        const metadataResponse = await fetchWithFallback(tokenURI)
        if (metadataResponse.ok) {
          const metadata = await parseMetadataJsonFromResponse(metadataResponse)

          metadataName = metadata?.name ?? null
          metadataDescription = metadata?.description ?? null
          metadataExternalUrl = metadata?.external_url ?? null
          metadataAttributes = (metadata?.attributes ?? [])
            .filter((a) => a?.trait_type != null)
            .map((a) => ({
              trait_type: String(a.trait_type),
              value: a.value != null ? String(a.value) : '—',
            }))

          if (metadata?.image) {
            let fixedImagePath = metadata.image
            const imagesCID =
              process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
            if (fixedImagePath.includes('/images/level')) {
              const levelMatch = fixedImagePath.match(/level(\d+)\.png/)
              if (levelMatch) {
                const levelNum = levelMatch[1]
                fixedImagePath =
                  levelNum === '10'
                    ? `ipfs://${imagesCID}/IP10Placeholder.png`
                    : `ipfs://${imagesCID}/IP${levelNum}.png`
              }
            }
            imageUrl = convertIPFSToGateway(fixedImagePath)
          }

          if (metadata?.animation_url) {
            let fixedAnimationPath = metadata.animation_url
            if (fixedAnimationPath.includes('/video/level10')) {
              fixedAnimationPath = `ipfs://${process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'}/IP10VIdeo.mp4`
            }
            animationUrl = convertIPFSToGateway(fixedAnimationPath)
          }
        }
      } catch (metadataError) {
        console.error('Error fetching Impact Product metadata:', metadataError)
      }
    }

    const imagesCID =
      process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
    const gateway = 'https://ipfs.io/ipfs/'

    const finalImageUrl =
      imageUrl ||
      (level > 0
        ? `${gateway}${imagesCID}/${level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`}`
        : '')

    const finalAnimationUrl =
      animationUrl || (level === 10 ? `${gateway}${imagesCID}/IP10VIdeo.mp4` : '')

    return {
      level,
      imageUrl: finalImageUrl,
      animationUrl: finalAnimationUrl,
      tokenId,
      metadataName,
      metadataDescription,
      metadataExternalUrl,
      metadataAttributes,
    }
  } catch (error) {
    console.error('Error fetching Impact Product data:', error)
    const imagesCID =
      process.env.NEXT_PUBLIC_IMPACT_IMAGES_CID || 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'
    const gateway = 'https://ipfs.io/ipfs/'
    return {
      level,
      imageUrl: level > 0 ? `${gateway}${imagesCID}/${level === 10 ? 'IP10Placeholder.png' : `IP${level}.png`}` : '',
      animationUrl: level === 10 ? `${gateway}${imagesCID}/IP10VIdeo.mp4` : '',
      tokenId,
      metadataName,
      metadataDescription,
      metadataExternalUrl,
      metadataAttributes,
    }
  }
}
