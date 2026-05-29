/** True on iPhone/iPad/Android mobile browsers (Safari, Chrome). */
export function isMobileBrowser(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}
