import {
  OrgHypercertsClaimActivity,
  OrgHypercertsContextAttachment,
  OrgHypercertsContextMeasurement,
  OrgHypercertsContextEvaluation,
} from '@hypercerts-org/lexicon'

function formatValidationIssues(issues: unknown): string {
  if (issues instanceof Error) return issues.message
  if (typeof issues === 'object' && issues !== null && 'message' in issues) {
    const message = (issues as { message: unknown }).message
    if (typeof message === 'string' && message.trim()) return message
  }
  if (typeof issues === 'string') return issues
  try {
    const serialized = JSON.stringify(issues)
    if (serialized && serialized !== '{}') return serialized
  } catch {
    // fall through
  }
  return String(issues)
}

export class LexiconValidationError extends Error {
  constructor(
    public readonly nsid: string,
    public readonly issues: unknown,
  ) {
    super(`Lexicon validation failed for ${nsid}: ${formatValidationIssues(issues)}`)
    this.name = 'LexiconValidationError'
  }
}

export function validateActivity(record: unknown): void {
  const result = OrgHypercertsClaimActivity.validateRecord(record as never)
  if (!result.success) {
    throw new LexiconValidationError('org.hypercerts.claim.activity', result.error)
  }
}

export function validateAttachment(record: unknown): void {
  const result = OrgHypercertsContextAttachment.validateRecord(record as never)
  if (!result.success) {
    throw new LexiconValidationError('org.hypercerts.context.attachment', result.error)
  }
}

export function validateMeasurement(record: unknown): void {
  const result = OrgHypercertsContextMeasurement.validateRecord(record as never)
  if (!result.success) {
    throw new LexiconValidationError('org.hypercerts.context.measurement', result.error)
  }
}

export function validateEvaluation(record: unknown): void {
  const result = OrgHypercertsContextEvaluation.validateRecord(record as never)
  if (!result.success) {
    throw new LexiconValidationError('org.hypercerts.context.evaluation', result.error)
  }
}
