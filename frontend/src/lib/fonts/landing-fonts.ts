import { Inter, Space_Grotesk } from 'next/font/google'

/** Inter (body) + Space Grotesk (headings, buttons, links, UI labels). */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
  adjustFontFallback: true,
})

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
  adjustFontFallback: true,
})

export const landingFontClassName = `${inter.variable} ${spaceGrotesk.variable}`
