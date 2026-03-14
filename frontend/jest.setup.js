// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Mock Next.js router
jest.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: jest.fn(),
      replace: jest.fn(),
      prefetch: jest.fn(),
      back: jest.fn(),
      pathname: '/',
      query: {},
      asPath: '/',
    }
  },
  usePathname() {
    return '/'
  },
  useSearchParams() {
    return new URLSearchParams()
  },
}))

// Mock window.ethereum for wallet tests
Object.defineProperty(window, 'ethereum', {
  value: {
    isMetaMask: true,
    request: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn(),
  },
  writable: true,
})

// Mock fetch globally
global.fetch = jest.fn()

// Mock environment variables
process.env.NEXT_PUBLIC_IMPACT_PRODUCT_CONTRACT = '0x1234567890123456789012345678901234567890'
process.env.NEXT_PUBLIC_SUBMISSION_CONTRACT = '0x1234567890123456789012345678901234567890'
process.env.NEXT_PUBLIC_REWARD_DISTRIBUTOR_CONTRACT = '0x1234567890123456789012345678901234567890'
process.env.NEXT_PUBLIC_IMPACT_METADATA_CID = 'bafybeifygxoux2l63muhba4j6gez3vlbe7enjnlkpjwfupylnkhgkqg54y'

