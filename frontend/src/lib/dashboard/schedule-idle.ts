/** Run work after first paint; falls back to a short timeout when idle callback is unavailable. */
export function scheduleIdle(task: () => void, timeoutMs = 2500): () => void {
  if (typeof window === 'undefined') {
    return () => {}
  }
  if (typeof requestIdleCallback !== 'undefined') {
    const id = requestIdleCallback(() => task(), { timeout: timeoutMs })
    return () => cancelIdleCallback(id)
  }
  const id = window.setTimeout(task, 80)
  return () => clearTimeout(id)
}
