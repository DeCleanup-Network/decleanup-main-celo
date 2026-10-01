import { getAddress } from 'viem'
import {
  MAX_PAYMENT_METHODS,
  parsePaymentMethods,
  validatePaymentMethods,
  cryptoRecipientFromMethods,
  eventPaymentMethods,
  SELECTABLE_PAYMENT_KINDS,
} from '@/lib/sponsor/payment-methods'
import { formatUsdAmount, normalizeBasePaymentTxHash, pickBasePayPayer } from '@/lib/sponsor/base-pay'

describe('sponsor payment methods', () => {
  it('parses Celo, Base, and Robinhood cards, and new apps can pick Robinhood', () => {
    const methods = parsePaymentMethods([
      { kind: 'crypto', recipientAddress: '0x1111111111111111111111111111111111111111' },
      { kind: 'crypto-base', recipientAddress: '0x2222222222222222222222222222222222222222' },
      { kind: 'crypto-robinhood', recipientAddress: '0x3333333333333333333333333333333333333333' },
    ])
    expect(methods).toHaveLength(3)
    expect(methods[0]?.kind).toBe('crypto')
    expect(methods[1]?.kind).toBe('crypto-base')
    expect(methods[2]?.kind).toBe('crypto-robinhood')
    expect(SELECTABLE_PAYMENT_KINDS).toContain('crypto-robinhood')
    expect(MAX_PAYMENT_METHODS).toBe(3)
    expect(
      eventPaymentMethods({
        paymentMethods: methods,
        recipientAddress: null,
      })
    ).toHaveLength(3)
  })

  it('offers Robinhood pay to the same 0x when a campaign already has a Celo recipient', () => {
    const listed = eventPaymentMethods({
      paymentMethods: [
        { kind: 'crypto', recipientAddress: '0x1111111111111111111111111111111111111111' },
      ],
      recipientAddress: null,
    })
    expect(listed.map((m) => m.kind)).toEqual(['crypto', 'crypto-robinhood'])
    expect(listed[1]?.recipientAddress).toBe(getAddress('0x1111111111111111111111111111111111111111'))
  })

  it('requires a recipient for Base crypto', () => {
    expect(validatePaymentMethods([{ kind: 'crypto-base', recipientAddress: '' }])).toMatch(/Base/)
    expect(
      validatePaymentMethods([
        { kind: 'crypto-base', recipientAddress: '0x1111111111111111111111111111111111111111' },
      ])
    ).toBeNull()
  })

  it('requires a recipient for Robinhood crypto', () => {
    expect(validatePaymentMethods([{ kind: 'crypto-robinhood', recipientAddress: '' }])).toMatch(
      /Robinhood/
    )
    expect(
      validatePaymentMethods([
        { kind: 'crypto-robinhood', recipientAddress: '0x1111111111111111111111111111111111111111' },
      ])
    ).toBeNull()
  })

  it('prefers Celo recipient, then Base, then Robinhood', () => {
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
    expect(
      cryptoRecipientFromMethods([
        { kind: 'crypto-robinhood', recipientAddress: '0x3333333333333333333333333333333333333333' },
      ])
    ).toBe(getAddress('0x3333333333333333333333333333333333333333'))
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
