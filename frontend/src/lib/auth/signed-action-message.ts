export function buildSignedActionMessage(
  action: string,
  extra: Record<string, string>,
  timestamp: number
): string {
  const extraLines = Object.entries(extra).map(([key, value]) => `${key}:${value}`)
  return [`DeCleanup ${action}`, ...extraLines, `timestamp:${timestamp}`].join('\n')
}
