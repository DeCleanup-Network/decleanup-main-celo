'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import { getIPFSUrl, getIPFSFallbackUrls } from '@/lib/blockchain/ipfs'

interface ImpactReportDetailsProps {
  impactReportHash?: string | null
  cleanupId?: bigint
}

export function ImpactReportDetails({ impactReportHash, cleanupId }: ImpactReportDetailsProps) {
  const [impactData, setImpactData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use localStorage to persist expanded state
  const expandedKey = cleanupId 
    ? `impact_expanded_${cleanupId.toString()}` 
    : impactReportHash 
    ? `impact_expanded_${impactReportHash}` 
    : null

  useEffect(() => {
    // Load expanded state from localStorage
    if (expandedKey && typeof window !== 'undefined') {
      const stored = localStorage.getItem(expandedKey)
      if (stored === 'true') {
        setExpanded(true)
      }
    }
  }, [expandedKey])

  useEffect(() => {
    async function fetchImpactData() {
      if (!impactReportHash || !expanded) {
        return // Only fetch when expanded
      }

      setLoading(true)
      setError(null)

      try {
        // Clean hash (remove ipfs:// prefix if present)
        const cleanHash = impactReportHash.replace(/^ipfs:\/\//, '').trim()

        if (!cleanHash) {
          setError('Invalid impact report hash')
          setLoading(false)
          return
        }

        // Use IPFS gateways with fallback
        const primaryUrl = getIPFSUrl(cleanHash)
        const fallbackUrls = getIPFSFallbackUrls(cleanHash)
        const urls = [primaryUrl, ...fallbackUrls]

        let data: any = null
        let lastError: Error | null = null

        // Try each gateway until one works
        for (const url of urls) {
          try {
            const response = await fetch(url, {
              mode: 'cors',
              cache: 'no-cache',
              headers: {
                'Accept': 'application/json',
              },
            })

            if (response.ok) {
              data = await response.json()
              break
            }
          } catch (err) {
            lastError = err instanceof Error ? err : new Error(String(err))
            continue
          }
        }

        if (!data) {
          throw lastError || new Error('Failed to fetch impact report data from IPFS')
        }

        setImpactData(data)
      } catch (err: any) {
        console.error('Error fetching impact report:', err)
        setError(err.message || 'Failed to load impact report data')
      } finally {
        setLoading(false)
      }
    }

    if (expanded) {
      fetchImpactData()
    }
  }, [impactReportHash, expanded])

  const toggleExpanded = (newValue: boolean) => {
    setExpanded(newValue)
    // Persist to localStorage
    if (expandedKey && typeof window !== 'undefined') {
      if (newValue) {
        localStorage.setItem(expandedKey, 'true')
      } else {
        localStorage.removeItem(expandedKey)
      }
    }
  }

  // No impact report
  if (!impactReportHash || impactReportHash.trim() === '') {
    return (
      <div className="mt-3 rounded-xl border border-gray-500/30 bg-gray-500/10 p-3 text-sm">
        <p className="font-semibold text-gray-400">Impact Report: Not submitted</p>
      </div>
    )
  }

  // Collapsed state
  if (!expanded) {
    return (
      <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-green-300">Impact Report: Submitted</p>
          <Button
            onClick={() => toggleExpanded(true)}
            variant="outline"
            size="sm"
            className="border-green-500/60 text-green-200 hover:bg-green-500/20"
          >
            <ChevronDown className="mr-1 h-3 w-3" />
            View Details
          </Button>
        </div>
      </div>
    )
  }

  // Loading state
  if (loading || (!impactData && !error)) {
    return (
      <div className="mt-3 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-green-300">Impact Report: Submitted</p>
          <Button
            onClick={() => toggleExpanded(false)}
            variant="outline"
            size="sm"
            className="border-green-500/60 text-green-200 hover:bg-green-500/20"
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            Hide Details
          </Button>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin text-green-300" />
          <p className="text-gray-300">Loading details...</p>
        </div>
      </div>
    )
  }

  // Error state
  if (error || !impactData) {
    return (
      <div className="mt-3 rounded-xl border border-yellow-500/40 bg-yellow-500/10 p-4 text-sm">
        <div className="flex items-center justify-between">
          <p className="font-semibold text-yellow-200">Impact Report: Submitted</p>
          <Button
            onClick={() => toggleExpanded(false)}
            variant="outline"
            size="sm"
            className="border-yellow-500/60 text-yellow-200 hover:bg-yellow-500/20"
          >
            <ChevronUp className="mr-1 h-3 w-3" />
            Hide Details
          </Button>
        </div>
        <p className="mt-2 text-gray-200">
          {error || 'Impact report metadata is unavailable. The IPFS hash may be invalid or the gateway may be unreachable.'}
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setError(null)
            setImpactData(null)
            setExpanded(true) // This will trigger the useEffect to fetch again
          }}
          className="mt-3 border-yellow-500/60 text-yellow-200 hover:bg-yellow-500/10"
        >
          Retry Load
        </Button>
      </div>
    )
  }

  // Expanded state with data
  return (
    <div className="mt-3 rounded-xl border border-green-500/40 bg-green-500/5 p-4 text-sm text-gray-100">
      <div className="mb-3 flex items-center justify-between">
        <p className="font-semibold uppercase tracking-wide text-green-300">
          Impact Report Details
        </p>
        <Button
          onClick={() => toggleExpanded(false)}
          variant="outline"
          size="sm"
          className="border-green-500/60 text-green-200 hover:bg-green-500/20"
        >
          <ChevronUp className="mr-1 h-3 w-3" />
          Hide Details
        </Button>
      </div>

      <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {impactData.locationType && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Location Type</dt>
            <dd className="text-base text-white">{impactData.locationType}</dd>
          </div>
        )}
        {impactData.area && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Area Cleaned</dt>
            <dd className="text-base text-white">
              {impactData.area} {impactData.areaUnit === 'sqm' ? 'm²' : 'ft²'}
            </dd>
          </div>
        )}
        {impactData.weight && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Weight Removed</dt>
            <dd className="text-base text-white">
              {impactData.weight} {impactData.weightUnit}
            </dd>
          </div>
        )}
        {impactData.bags && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Bags Filled</dt>
            <dd className="text-base text-white">{impactData.bags}</dd>
          </div>
        )}
        {(impactData.hours || impactData.minutes) && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Time Spent</dt>
            <dd className="text-base text-white">
              {impactData.hours || 0}h {impactData.minutes || 0}m
            </dd>
          </div>
        )}
        {impactData.wasteTypes && impactData.wasteTypes.length > 0 && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Waste Types</dt>
            <dd className="text-base text-white">{impactData.wasteTypes.join(', ')}</dd>
          </div>
        )}
        {impactData.contributors && impactData.contributors.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-gray-400">Contributors</dt>
            <dd className="mt-1 space-y-1 text-base text-white">
              {impactData.contributors.map((addr: string, i: number) => (
                <div key={i} className="font-mono text-sm break-all">
                  {addr}
                </div>
              ))}
            </dd>
          </div>
        )}
        {impactData.scopeOfWork && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-gray-400">Scope of Work</dt>
            <dd className="text-base text-white">{impactData.scopeOfWork}</dd>
          </div>
        )}
        {impactData.rightsAssignment && (
          <div>
            <dt className="text-xs uppercase text-gray-400">Rights Assignment</dt>
            <dd className="text-base text-white">{impactData.rightsAssignment}</dd>
          </div>
        )}
        {impactData.environmentalChallenges && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-gray-400">Environmental Challenges</dt>
            <dd className="text-base text-white">{impactData.environmentalChallenges}</dd>
          </div>
        )}
        {impactData.preventionIdeas && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-gray-400">Prevention Suggestions</dt>
            <dd className="text-base text-white">{impactData.preventionIdeas}</dd>
          </div>
        )}
        {impactData.additionalNotes && (
          <div className="sm:col-span-2">
            <dt className="text-xs uppercase text-gray-400">Additional Notes</dt>
            <dd className="text-base text-white whitespace-pre-wrap">{impactData.additionalNotes}</dd>
          </div>
        )}
      </dl>

      <p className="mt-4 text-xs text-gray-400">
        * Impact report data is self-reported; verify details against the provided photos before approving.
      </p>
    </div>
  )
}
