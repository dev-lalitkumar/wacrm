const REDACT_HEADERS = new Set([
  'x-webhook-secret',
  'authorization',
  'cookie',
])

export function sanitizeInboundHeaders(
  headers: Headers | Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = {}
  if (headers instanceof Headers) {
    headers.forEach((value, key) => {
      const lower = key.toLowerCase()
      if (REDACT_HEADERS.has(lower)) {
        out[lower] = '[redacted]'
      } else {
        out[lower] = value
      }
    })
    return out
  }

  for (const [key, value] of Object.entries(headers)) {
    const lower = key.toLowerCase()
    out[lower] = REDACT_HEADERS.has(lower) ? '[redacted]' : value
  }
  return out
}
