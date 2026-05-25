import { z } from 'zod'
import { isAddress } from 'viem'

const addressSchema = z.string().refine((v) => isAddress(v), { message: 'Invalid address' })

export const encryptedBlobSchema = z.object({
  version: z.literal(1),
  encryptedData: z.string().min(1),
  iv: z.string().min(1),
  salt: z.string().min(1),
})

export const syncWalletSchema = z.object({
  address: addressSchema,
  smartAccountAddress: addressSchema,
  encryptedBlob: encryptedBlobSchema,
  chainId: z.number().int().positive().optional(),
})

export const sendTransactionSchema = z.object({
  to: addressSchema,
  value: z
    .string()
    .optional()
    .transform((v) => (v && v.length > 0 ? BigInt(v) : 0n)),
  data: z
    .string()
    .optional()
    .refine((v) => !v || /^0x[0-9a-fA-F]*$/.test(v), { message: 'Invalid calldata' })
    .transform((v) => (v && v.length > 2 ? (v as `0x${string}`) : '0x')),
})

export const receiptQuerySchema = z.object({
  hash: z.string().regex(/^0x[0-9a-fA-F]{64}$/, 'Invalid userOp hash'),
})
