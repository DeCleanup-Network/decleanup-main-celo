import { getAddress } from 'viem'
import {
  MAX_PAYMENT_METHODS,
  parsePaymentMethods,
  validatePaymentMethods,
  cryptoRecipientFromMethods,
} from '@/lib/sponsor/payment-methods'
import { formatUsdAmount, normalizeBasePaymentTxHash, pickBasePayPayer } from '@/lib/sponsor/base-pay'

describe('sponsor payment methods', () => {
  it('parses Celo and Base crypto cards', () => {
    const methods = parsePaymentMethods([
      { kind: 'crypto', recipientAddress: '0x1111111111111111111111111111111111111111' },
      { kind: 'crypto-base', recipientAddress: '0x2222222222222222222222222222222222222222' },
    ])
    expect(methods).toHaveLength(2)
    expect(methods[0]?.kind).toBe('crypto')
    expect(methods[1]?.kind).toBe('crypto-base')
    expect(MAX_PAYMENT_METHODS).toBe(3)
  })

  it('requires a recipient for Base crypto', () => {
    expect(validatePaymentMethods([{ kind: 'crypto-base', recipientAddress: '' }])).toMatch(/Base/)
    expect(
      validatePaymentMethods([
        { kind: 'crypto-base', recipientAddress: '0x1111111111111111111111111111111111111111' },
      ])
    ).toBeNull()
  })

  it('prefers Celo recipient, then Base', () => {
    expect(
      cryptoRecipientFromMethods([
        { kind: 'crypto-base', recipientAddress: '0x2222222222222222222222222222222222222222' },
      ])
    ).toBe(getAddress('0x2222222222222222222222222222222222222222'))
    expect(
      cryptoRecipientFromMethods([
        { kind: 'crypto', recipientAddress: '0x1111111111111111111111111111111111111111' },
        { kind: 'crypto-base', recipientAddress: '0x2222222222222222222222222222222222222222' },
      ])
    ).toBe(getAddress('0x1111111111111111111111111111111111111111'))
  })
})

describe('Base Pay helpers', () => {
  it('formats USD amounts for the SDK', () => {
    expect(formatUsdAmount('10')).toBe('10.00')
    expect(formatUsdAmount('0')).toBeNull()
    expect(formatUsdAmount('abc')).toBeNull()
  })

  it('only accepts 32-byte tx hashes', () => {
    expect(
      normalizeBasePaymentTxHash('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    ).toBe('0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa')
    expect(normalizeBasePaymentTxHash('not-a-hash')).toBeNull()
  })

  it('picks a payer from status or the connected wallet', () => {
    expect(
      pickBasePayPayer({
        statusFrom: '0x3333333333333333333333333333333333333333',
        connectedAddress: '0x4444444444444444444444444444444444444444',
      })
    ).toBe('0x3333333333333333333333333333333333333333')
    expect(
      pickBasePayPayer({
        statusFrom: null,
        connectedAddress: '0x4444444444444444444444444444444444444444',
      })
    ).toBe('0x4444444444444444444444444444444444444444')
  })
})
