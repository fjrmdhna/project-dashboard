/** Title Case label for region_circle (aligned with AOP / Hermes). */
export function formatTlpCircleLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase())
}

export function normalizeTlpCircleKey(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const trimmed = String(value).trim()
  return trimmed ? trimmed.toLowerCase() : null
}

export function resolveTlpCircleLabel(value: unknown): string {
  const key = normalizeTlpCircleKey(value)
  if (!key) return "Unknown"
  return formatTlpCircleLabel(String(value).trim())
}
