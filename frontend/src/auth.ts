import NextAuth from 'next-auth'
import { authConfig } from '@/lib/auth/config'
import { warnIfDatabaseMisconfigured } from '@/lib/auth/validate-database-env'
import { warnIfGoogleOAuthMisconfigured } from '@/lib/auth/validate-google-oauth-env'

warnIfGoogleOAuthMisconfigured()
warnIfDatabaseMisconfigured()

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
