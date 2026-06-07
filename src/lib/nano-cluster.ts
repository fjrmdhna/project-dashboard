/** Returns trimmed nano cluster name, or null when missing/blank. */
export function getValidNanoClusterName(value?: string | null): string | null {
  if (value == null) return null
  const trimmed = String(value).trim()
  return trimmed.length > 0 ? trimmed : null
}
