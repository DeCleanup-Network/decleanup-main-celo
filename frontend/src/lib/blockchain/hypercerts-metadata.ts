// Placeholder for MVP; Hypercert metadata disabled.
// Remove when Hypercerts integration returns.

export type HypercertMetadata = {
    title: string
    description: string
    image: string
  }
  
  export function getHypercertMetadata(_level: number): HypercertMetadata {
    return {
      title: 'Hypercert (disabled in MVP)',
      description: 'Hypercert functionality is disabled for this MVP build.',
      image: '/placeholder.png',
    }
  }
  