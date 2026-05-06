/**
 * DMRV Metrics & Telemetry
 * Tracks auto-approval rate, confidence distribution, etc.
 */

import { VerificationResponse } from './types'

interface MetricsData {
  totalVerifications: number
  autoApprovals: number
  manualReviews: number
  averageConfidence: number
  confidenceDistribution: {
    high: number // >= 0.85
    medium: number // 0.60 - 0.85
    low: number // < 0.60
  }
  lastUpdated: number
}

const METRICS_KEY = 'dmrv_metrics'

/**
 * Load metrics from localStorage
 */
export function loadMetrics(): MetricsData {
  if (typeof window === 'undefined') {
    return getDefaultMetrics()
  }
  
  try {
    const stored = localStorage.getItem(METRICS_KEY)
    if (stored) {
      return JSON.parse(stored) as MetricsData
    }
  } catch (error) {
    console.error('[DMRV Metrics] Error loading metrics:', error)
  }
  
  return getDefaultMetrics()
}

/**
 * Get default metrics structure
 */
function getDefaultMetrics(): MetricsData {
  return {
    totalVerifications: 0,
    autoApprovals: 0,
    manualReviews: 0,
    averageConfidence: 0,
    confidenceDistribution: {
      high: 0,
      medium: 0,
      low: 0,
    },
    lastUpdated: Date.now(),
  }
}

/**
 * Record a verification result
 */
export function recordVerification(result: VerificationResponse): void {
  if (typeof window === 'undefined') {
    return
  }
  
  try {
    const metrics = loadMetrics()
    
    metrics.totalVerifications++
    
    if (result.decision === 'AUTO_APPROVED') {
      metrics.autoApprovals++
    } else {
      metrics.manualReviews++
    }
    
    // Update average confidence
    const totalConfidence = metrics.averageConfidence * (metrics.totalVerifications - 1) + result.confidence
    metrics.averageConfidence = totalConfidence / metrics.totalVerifications
    
    // Update confidence distribution
    if (result.confidence >= 0.85) {
      metrics.confidenceDistribution.high++
    } else if (result.confidence >= 0.60) {
      metrics.confidenceDistribution.medium++
    } else {
      metrics.confidenceDistribution.low++
    }
    
    metrics.lastUpdated = Date.now()
    
    localStorage.setItem(METRICS_KEY, JSON.stringify(metrics))
    
    // Log to console
    console.log('[DMRV Metrics]', {
      total: metrics.totalVerifications,
      autoApprovalRate: `${((metrics.autoApprovals / metrics.totalVerifications) * 100).toFixed(1)}%`,
      avgConfidence: metrics.averageConfidence.toFixed(3),
      distribution: metrics.confidenceDistribution,
    })
  } catch (error) {
    console.error('[DMRV Metrics] Error recording metrics:', error)
  }
}

/**
 * Get current metrics summary
 */
export function getMetricsSummary(): {
  totalVerifications: number
  autoApprovalRate: number
  averageConfidence: number
  confidenceDistribution: MetricsData['confidenceDistribution']
} {
  const metrics = loadMetrics()
  
  return {
    totalVerifications: metrics.totalVerifications,
    autoApprovalRate: metrics.totalVerifications > 0
      ? metrics.autoApprovals / metrics.totalVerifications
      : 0,
    averageConfidence: metrics.averageConfidence,
    confidenceDistribution: metrics.confidenceDistribution,
  }
}

/**
 * Reset metrics (for testing)
 */
export function resetMetrics(): void {
  if (typeof window === 'undefined') {
    return
  }
  
  localStorage.removeItem(METRICS_KEY)
  console.log('[DMRV Metrics] Metrics reset')
}
