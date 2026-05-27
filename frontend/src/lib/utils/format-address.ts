/** Shorten 0x address for tight UI (mobile). */
export function formatAddress(address: string, head = 6, tail = 4): string {
  const a = address.trim()
  if (a.length <= head + tail + 2) return a
  return `${a.slice(0, head + 2)}…${a.slice(-tail)}`
}
