import 'server-only'
import { auth } from '@/auth'
import { isAaAuthEnabled } from '@/lib/auth/is-aa-auth-enabled'

export async function requireSessionUserId(): Promise<string> {
  if (!isAaAuthEnabled()) {
    throw new Error('AA authentication is not configured on this server.')
  }
  const session = await auth()
  const userId = session?.user?.id
  if (!userId) {
    throw new Error('UNAUTHORIZED')
  }
  return userId
}
