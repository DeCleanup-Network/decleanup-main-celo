export function BaseUserGuide() {
  return (
    <iframe
      src="/guide-base.html"
      title="User Guide - Base"
      className="block w-full border-0 bg-background"
      style={{
        height: 'calc(100dvh - 5.5rem - env(safe-area-inset-top, 0px))',
        minHeight: '32rem',
      }}
    />
  )
}
