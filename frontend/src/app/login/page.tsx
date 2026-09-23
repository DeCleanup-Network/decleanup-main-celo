import { redirect } from 'next/navigation'
import { isEmailLoginEnabled } from '@/lib/auth/config'
import { safeCallbackUrl } from '@/lib/auth/safe-callback-url'
import LoginPageClient from './LoginPageClient'

type SearchValue = string | string[] | undefined

type Search = {
  callbackUrl?: SearchValue
  error?: SearchValue
  email?: SearchValue
}

function first(value: SearchValue): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

function loginHref(search: Search): string {
  const params = new URLSearchParams()
  const error = first(search.error)
  const email = first(search.email)
  if (error) params.set('error', error)
  if (email) params.set('email', email)
  const query = params.toString()
  return query ? `/login?${query}` : '/login'
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Search>
}) {
  const resolved = await searchParams
  const raw = first(resolved.callbackUrl)
  if (raw && safeCallbackUrl(raw) === '/' && raw !== '/') {
    redirect(loginHref(resolved))
  }

  return <LoginPageClient emailLoginEnabled={isEmailLoginEnabled()} />
}
