/** Abort fetch when it exceeds `timeoutMs` (avoids infinite "Setting up your account"). */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = 20_000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  const signal = init?.signal
  if (signal) {
    if (signal.aborted) {
      clearTimeout(timeout)
      throw new DOMException('Aborted', 'AbortError')
    }
    signal.addEventListener('abort', () => controller.abort(), { once: true })
  }
  try {
    return await fetch(input, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timeout)
  }
}

export function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${label} timed out after ${Math.round(timeoutMs / 1000)}s`))
    }, timeoutMs)
    promise
      .then((v) => {
        clearTimeout(timer)
        resolve(v)
      })
      .catch((e) => {
        clearTimeout(timer)
        reject(e)
      })
  })
}
