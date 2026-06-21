/** Local calendar date as YYYY-MM-DD (not UTC — avoids off-by-one near midnight). */
export function getLocalTodayDateString(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Blank is allowed (submit uses today). Otherwise must be today or earlier. */
export function isCleanupDateAllowed(dateStr: string): boolean {
  const trimmed = dateStr.trim()
  if (!trimmed) return true
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return false
  return trimmed <= getLocalTodayDateString()
}
