import { isEmailLoginEnabled } from '@/lib/auth/config'
import LoginPageClient from './LoginPageClient'

export default function LoginPage() {
  return <LoginPageClient emailLoginEnabled={isEmailLoginEnabled()} />
}
