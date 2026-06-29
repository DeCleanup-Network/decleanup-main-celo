import { NextRequest, NextResponse } from 'next/server'

/**
 * Ops-only diagnostic routes (Pinata test, ML health, ATProto config).
 * In production: returns 404 unless OPS_DIAGNOSTIC_SECRET matches x-ops-diagnostic-secret.
 */
export function rejectOpsDiagnosticUnlessAuthorized(
  request?: NextRequest
): NextResponse | null {
  if (process.env.NODE_ENV !== 'production') return null

  const secret = process.env.OPS_DIAGNOSTIC_SECRET?.trim()
  if (!secret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const provided = request?.headers.get('x-ops-diagnostic-secret')?.trim()
  if (provided !== secret) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return null
}
