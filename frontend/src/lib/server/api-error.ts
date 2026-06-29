import { NextResponse } from 'next/server'

const GENERIC_MESSAGE = 'An unexpected error occurred. Please try again later.'

export function logApiError(context: string, error: unknown): void {
  if (error instanceof Error) {
    console.error(`[${context}]`, error.stack ?? error.message)
    return
  }
  console.error(`[${context}]`, error)
}

/** Safe client-facing message — full detail only in development. */
export function apiErrorMessage(error: unknown, fallback = GENERIC_MESSAGE): string {
  if (process.env.NODE_ENV === 'development') {
    return error instanceof Error ? error.message : String(error)
  }
  return fallback
}

export function apiJsonError(
  status: number,
  error: unknown,
  fallback = GENERIC_MESSAGE
): NextResponse {
  return NextResponse.json({ error: apiErrorMessage(error, fallback) }, { status })
}

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production'
}
