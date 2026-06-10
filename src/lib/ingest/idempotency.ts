import crypto from 'node:crypto'

export function integrationIdempotencyKey(
  webhookId: string,
  rawBody: string,
  headerKey?: string | null,
): string {
  if (headerKey?.trim()) {
    return `hdr:${headerKey.trim()}`
  }
  const hash = crypto
    .createHash('sha256')
    .update(webhookId)
    .update('\0')
    .update(rawBody)
    .digest('hex')
  return `body:${hash}`
}
