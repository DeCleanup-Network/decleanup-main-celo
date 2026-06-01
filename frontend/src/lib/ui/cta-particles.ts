/** Green burst on primary CTA click — matches decleanup-landing-standalone. */
export function spawnCtaParticles(
  el: HTMLElement,
  clientX: number,
  clientY: number
): void {
  if (typeof window === 'undefined') return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const prevPosition = el.style.position
  if (!prevPosition || prevPosition === 'static') {
    el.style.position = 'relative'
  }

  for (let i = 0; i < 12; i++) {
    const p = document.createElement('span')
    p.className = 'cta-particle'
    const angle = (Math.PI * 2 * i) / 12 + (Math.random() - 0.5) * 0.4
    const dist = 28 + Math.random() * 36
    const tx = Math.cos(angle) * dist
    const ty = Math.sin(angle) * dist - 18
    p.style.setProperty('--tx', `${tx}px`)
    p.style.setProperty('--ty', `${ty}px`)
    p.style.left = `${x}px`
    p.style.top = `${y}px`
    p.style.animationDuration = `${0.55 + Math.random() * 0.25}s`
    el.appendChild(p)
    window.setTimeout(() => p.remove(), 900)
  }
}
