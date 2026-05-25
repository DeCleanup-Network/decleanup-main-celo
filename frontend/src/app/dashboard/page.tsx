import { redirect } from 'next/navigation'

/** Legacy route — main app is home; wallet tools live under /wallet */
export default function DashboardRedirectPage() {
  redirect('/')
}
