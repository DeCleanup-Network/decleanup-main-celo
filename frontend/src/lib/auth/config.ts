import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Email from 'next-auth/providers/email'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
const providers: NextAuthConfig['providers'] = []

if (process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

if (process.env.EMAIL_SERVER?.trim()) {
  providers.push(
    Email({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM?.trim() || 'noreply@decleanup.net',
    })
  )
}

export function isEmailLoginEnabled(): boolean {
  return Boolean(process.env.EMAIL_SERVER?.trim())
}

export const authConfig = {
  adapter: PrismaAdapter(prisma),
  providers,
  pages: {
    signIn: '/login',
    error: '/login',
    verifyRequest: '/login?email=sent',
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  cookies: {
    sessionToken: {
      name:
        process.env.NODE_ENV === 'production'
          ? '__Secure-authjs.session-token'
          : 'authjs.session-token',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
  },
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider) {
        token.authProvider = account.provider
      }
      if (user?.id) token.sub = user.id
      return token
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub
      }
      if (typeof token.authProvider === 'string') {
        session.authProvider = token.authProvider
      }
      return session
    },
  },
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  debug: process.env.NODE_ENV === 'development',
} satisfies NextAuthConfig
