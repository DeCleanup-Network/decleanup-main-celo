/**
 * Zod Validation Schemas for Verifier APIs
 */

import { z } from 'zod'

/**
 * Wallet address validation
 */
const WalletAddressSchema = z
  .string()
  .regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid wallet address')

/**
 * POST /api/verifier/apply
 */
export const VerifierApplySchema = z.object({
  address: WalletAddressSchema,
  metrics: z.object({
    level: z.number().int().nonnegative('Level must be non-negative'),
    dcuBalance: z.number().nonnegative('DCU balance must be non-negative'),
    approvedCleanups: z.number().int().nonnegative('Cleanups must be non-negative'),
  }),
})

export type VerifierApplyInput = z.infer<typeof VerifierApplySchema>

/**
 * POST /api/verifier/review
 */
export const VerifierReviewSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  decision: z.enum(['APPROVE', 'REJECT']),
  reviewedBy: WalletAddressSchema,
  notes: z.string().max(500, 'Notes too long').optional(),
})

export type VerifierReviewInput = z.infer<typeof VerifierReviewSchema>

/**
 * POST /api/verifier/review/init
 */
export const VerifierReviewInitSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  reviewedBy: WalletAddressSchema,
  notes: z.string().max(500, 'Notes too long').optional(),
})

export type VerifierReviewInitInput = z.infer<typeof VerifierReviewInitSchema>

/**
 * POST /api/verifier/review/confirm
 */
export const VerifierReviewConfirmSchema = z.object({
  applicationId: z.string().uuid('Invalid application ID'),
  txHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/, 'Invalid transaction hash'),
})

export type VerifierReviewConfirmInput = z.infer<typeof VerifierReviewConfirmSchema>

/**
 * Validation result type
 */
type ValidationSuccess<T> = { success: true; data: T }
type ValidationError = { success: false; errors: z.ZodError }
type ValidationResult<T> = ValidationSuccess<T> | ValidationError

/**
 * Validation helper with proper typing
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): ValidationResult<T> {
  const result = schema.safeParse(data)
  
  if (!result.success) {
    return { success: false, errors: result.error }
  }
  
  return { success: true, data: result.data }
}
