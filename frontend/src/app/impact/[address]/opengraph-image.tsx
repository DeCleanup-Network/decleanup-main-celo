import { ImageResponse } from 'next/og'
import { isAddress } from 'viem'
import type { Address } from 'viem'
import { fetchPublicPortfolioData } from '@/lib/impact/public-portfolio-data'
import { resolveWalletIdentity } from '@/lib/wallet/resolve-identity'

export const runtime = 'nodejs'
export const alt = 'DeCleanup Impact Portfolio'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

/** Keep OG generation within typical serverless limits if RPC is slow */
const OG_FETCH_MS = 12_000

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([
    p.then((v) => v as T).catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ])
}

function shortAddr(a: string) {
  if (a.length > 12 && a.startsWith('0x')) return `${a.slice(0, 6)}…${a.slice(-4)}`
  return a.length > 24 ? `${a.slice(0, 10)}…` : a
}

export default async function Image({ params }: { params: { address: string } }) {
  const raw = decodeURIComponent(params.address || '').trim()
  const addrOk = isAddress(raw)

  let displayAddr = shortAddr(raw)
  let totalDcu = '-'
  let verified = '-'
  let reports = '-'
  let level = '-'

  if (addrOk) {
    const identity = await resolveWalletIdentity(raw).catch(() => null)
    const eoa = (identity?.eoaAddress ?? raw) as Address
    displayAddr = shortAddr(eoa)
    const submissionOwner =
      identity?.smartAccountAddress &&
      identity.smartAccountAddress.toLowerCase() !== eoa.toLowerCase()
        ? identity.smartAccountAddress
        : undefined

    const data = await withTimeout(
      fetchPublicPortfolioData(eoa, { submissionOwner }),
      OG_FETCH_MS
    )
    if (data) {
      totalDcu = Math.round(data.rewards.totalDcuBreakdown).toString()
      verified = String(data.verifiedCleanups)
      reports = String(data.verifiedWithReport)
      level = data.level > 0 ? `Lv ${data.level}` : '-'
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 56,
          background: 'linear-gradient(145deg, #0a0a0a 0%, #121a12 45%, #0a0a0a 100%)',
          border: '2px solid #58B12F',
          borderRadius: 24,
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica Neue, Arial, sans-serif',
          color: '#f4f4f5',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span
              style={{
                fontSize: 28,
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#58B12F',
                textTransform: 'uppercase',
              }}
            >
              DeCleanup Rewards
            </span>
            <span
              style={{
                fontSize: 52,
                fontWeight: 800,
                letterSpacing: '0.06em',
                color: '#fafafa',
                textTransform: 'uppercase',
                lineHeight: 1.05,
              }}
            >
              Impact Portfolio
            </span>
            <span style={{ fontSize: 26, color: '#a1a1aa', fontFamily: 'ui-monospace, monospace' }}>
              {displayAddr}
            </span>
          </div>
          <div
            style={{
              fontSize: 22,
              color: '#d4d4d8',
              textAlign: 'right',
              maxWidth: 420,
              lineHeight: 1.35,
            }}
          >
            Verified cleanup impact and DCU. Shareable proof of field activity on Celo.
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', gap: 20, marginTop: 24 }}>
          {[
            { label: 'DCU (recognized)', value: totalDcu },
            { label: 'Verified cleanups', value: verified },
            { label: 'Impact reports', value: reports },
            { label: 'Impact Product', value: level },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                padding: '20px 22px',
                borderRadius: 16,
                background: 'rgba(88, 177, 47, 0.12)',
                border: '1px solid rgba(88, 177, 47, 0.35)',
                minWidth: 0,
              }}
            >
              <span style={{ fontSize: 18, color: '#a1a1aa', marginBottom: 10 }}>{item.label}</span>
              <span
                style={{
                  fontSize: 44,
                  fontWeight: 800,
                  color: '#FAFF00',
                  letterSpacing: '0.02em',
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 28,
            fontSize: 20,
            color: '#71717a',
            letterSpacing: '0.04em',
          }}
        >
          dapp.decleanup.net · Onchain verification
        </div>
      </div>
    ),
    { ...size }
  )
}
