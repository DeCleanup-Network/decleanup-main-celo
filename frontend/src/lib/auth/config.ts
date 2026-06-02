import type { NextAuthConfig } from 'next-auth'
import Google from 'next-auth/providers/google'
import Email from 'next-auth/providers/email'
import { PrismaAdapter } from '@auth/prisma-adapter'
import { prisma } from '@/lib/db/prisma'
import { sendResendMagicLink } from '@/lib/auth/resend-magic-link'

const providers: NextAuthConfig['providers'] = []

const defaultEmailFrom = 'DeCleanup <onboarding@resend.dev>'

function getEmailFrom(): string {
  return process.env.EMAIL_FROM?.trim() || defaultEmailFrom
}

if (process.env.GOOGLE_CLIENT_ID?.trim() && process.env.GOOGLE_CLIENT_SECRET?.trim()) {
  providers.push(
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    })
  )
}

const resendApiKey = process.env.RESEND_API_KEY?.trim()
const emailServer = process.env.EMAIL_SERVER?.trim()

if (resendApiKey) {
  const from = getEmailFrom()
  // Auth.js still instantiates Nodemailer at load time; `server` is required even when
  // we send via Resend HTTP API in sendVerificationRequest (SMTP is never called).
  providers.push(
    Email({
      server: {
        host: 'smtp.resend.com',
        port: 587,
        auth: { user: 'resend', pass: resendApiKey },
      },
      from,
      async sendVerificationRequest({ identifier: email, url, provider }) {
        await sendResendMagicLink({
          apiKey: resendApiKey,
          from: provider.from ?? from,
          to: email,
          url,
        })
      },
    })
  )
} else if (emailServer) {
  providers.push(
    Email({
      server: emailServer,
      from: getEmailFrom(),
    })
  )
}

export function isEmailLoginEnabled(): boolean {
  return Boolean(resendApiKey || emailServer)
}

export function getEmailLoginMode(): 'resend-api' | 'smtp' | 'off' {
  if (resendApiKey) return 'resend-api'
  if (emailServer) return 'smtp'
  return 'off'
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
