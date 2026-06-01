import { getAaWagmiCookieConfigSingleton } from '@/lib/blockchain/aa-wagmi-cookie-config'

/** @deprecated Use aa-wagmi-cookie-config for server / aa-wagmi-config for client. */
export const getMinimalWagmiConfig = getAaWagmiCookieConfigSingleton
export const minimalWagmiConfig = getAaWagmiCookieConfigSingleton()
export { getAaWagmiCookieConfig as createMinimalWagmiConfig } from '@/lib/blockchain/aa-wagmi-cookie-config'
