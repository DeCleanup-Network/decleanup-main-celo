/// <reference lib="webworker" />
import { defaultCache } from '@serwist/next/worker'
import type { PrecacheEntry, RuntimeCaching, SerwistGlobalConfig } from 'serwist'
import { NetworkOnly, Serwist } from 'serwist'

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined
  }
}

declare const self: ServiceWorkerGlobalScope

/**
 * Never cache auth, wallet, or API traffic — stale responses break login / AA / passkeys.
 * NetworkOnly rules must come before defaultCache.
 */
const sensitiveNetworkOnly: RuntimeCaching[] = [
  {
    matcher: ({ sameOrigin, url }) => sameOrigin && url.pathname.startsWith('/api/'),
    handler: new NetworkOnly(),
  },
  {
    matcher: ({ sameOrigin, url }) =>
      sameOrigin &&
      (url.pathname === '/login' ||
        url.pathname.startsWith('/login/') ||
        url.pathname.startsWith('/api/auth')),
    handler: new NetworkOnly(),
  },
]

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  // Controlled activation via PwaUpdateToast (SKIP_WAITING message)
  skipWaiting: false,
  clientsClaim: true,
  navigationPreload: true,
  disableDevLogs: true,
  runtimeCaching: [...sensitiveNetworkOnly, ...defaultCache],
  fallbacks: {
    entries: [
      {
        url: '/~offline',
        matcher({ request }) {
          return request.destination === 'document'
        },
      },
    ],
  },
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    void self.skipWaiting()
  }
})

self.addEventListener('push', (event) => {
  let title = 'DeCleanup Rewards'
  let body = 'You have a new update'
  let href = '/'
  try {
    const data = event.data?.json() as { title?: string; body?: string; href?: string } | undefined
    if (data?.title) title = data.title
    if (data?.body) body = data.body
    if (data?.href) href = data.href
  } catch {
    const text = event.data?.text()
    if (text) body = text
  }
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { href },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const href =
    (event.notification.data && (event.notification.data as { href?: string }).href) || '/'
  const url = new URL(href, self.location.origin).href
  event.waitUntil(
    (async () => {
      const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      for (const client of clientsList) {
        if ('focus' in client) {
          await client.focus()
          if ('navigate' in client) {
            await (client as WindowClient).navigate(url)
          }
          return
        }
      }
      await self.clients.openWindow(url)
    })()
  )
})

serwist.addEventListeners()
