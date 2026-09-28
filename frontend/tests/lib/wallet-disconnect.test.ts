/**
 * @jest-environment jsdom
 */
import {
  clearManualWalletDisconnect,
  isManualWalletDisconnectActive,
  MANUAL_WALLET_DISCONNECT_KEY,
  markManualWalletDisconnect,
} from '@/lib/blockchain/wallet-disconnect-flag'

describe('manual wallet disconnect flag', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('is inactive by default and active after mark', () => {
    expect(isManualWalletDisconnectActive()).toBe(false)
    markManualWalletDisconnect()
    expect(sessionStorage.getItem(MANUAL_WALLET_DISCONNECT_KEY)).toBeTruthy()
    expect(isManualWalletDisconnectActive()).toBe(true)
  })

  it('clears so a later connect can auto-login again', () => {
    markManualWalletDisconnect()
    clearManualWalletDisconnect()
    expect(isManualWalletDisconnectActive()).toBe(false)
  })
})
