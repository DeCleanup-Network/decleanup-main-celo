import { Inter, Space_Grotesk, Space_Mono } from 'next/font/google'

/** Matches decleanup-landing-standalone: Inter body, Space Grotesk display, Space Mono labels. */
export const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
})

export const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-space-grotesk',
  display: 'swap',
})

export const spaceMono = Space_Mono({
  subsets: ['latin'],
  weight: ['400', '700'],
  variable: '--font-space-mono',
  display: 'swap',
})

export const landingFontClassName = `${inter.variable} ${spaceGrotesk.variable} ${spaceMono.variable}`
