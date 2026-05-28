/**
 * RFC 2822 MIME message builder for the Gmail API.
 *
 * Gmail's `messages.send` endpoint expects a base64url-encoded MIME
 * message. This builder handles plain-text, HTML, and multipart
 * alternative messages without pulling in nodemailer or similar.
 */

export interface MimeOptions {
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyText?: string
  bodyHtml?: string
  inReplyTo?: string
  references?: string
}

export function buildMimeMessage(opts: MimeOptions): string {
  const boundary = `----=_Part_${Date.now()}_${Math.random().toString(36).slice(2)}`
  const lines: string[] = []

  // Headers
  lines.push(`From: ${opts.from}`)
  lines.push(`To: ${opts.to.join(', ')}`)
  if (opts.cc?.length) lines.push(`Cc: ${opts.cc.join(', ')}`)
  if (opts.bcc?.length) lines.push(`Bcc: ${opts.bcc.join(', ')}`)
  lines.push(`Subject: ${mimeEncodeSubject(opts.subject)}`)
  lines.push(`Date: ${new Date().toUTCString()}`)
  lines.push('MIME-Version: 1.0')

  // Threading headers
  if (opts.inReplyTo) {
    lines.push(`In-Reply-To: <${opts.inReplyTo}>`)
    lines.push(`References: ${opts.references ?? `<${opts.inReplyTo}>`}`)
  }

  const hasText = !!opts.bodyText
  const hasHtml = !!opts.bodyHtml

  if (hasText && hasHtml) {
    // Multipart alternative
    lines.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    lines.push('')
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(base64Chunk(opts.bodyText!))
    lines.push(`--${boundary}`)
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(base64Chunk(opts.bodyHtml!))
    lines.push(`--${boundary}--`)
  } else if (hasHtml) {
    lines.push('Content-Type: text/html; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(base64Chunk(opts.bodyHtml!))
  } else {
    lines.push('Content-Type: text/plain; charset=UTF-8')
    lines.push('Content-Transfer-Encoding: base64')
    lines.push('')
    lines.push(base64Chunk(opts.bodyText || ''))
  }

  return lines.join('\r\n')
}

/**
 * Base64url-encode a raw MIME string for the Gmail API `raw` field.
 */
export function mimeToBase64Url(mime: string): string {
  return Buffer.from(mime)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

// ── internal helpers ────────────────────────────────────────────

function base64Chunk(text: string): string {
  // Split base64 output into 76-char lines per RFC 2045
  const b64 = Buffer.from(text, 'utf8').toString('base64')
  return b64.match(/.{1,76}/g)?.join('\r\n') ?? b64
}

/**
 * RFC 2047 Q-encoding for subjects with non-ASCII chars.
 * If the subject is pure ASCII, returns it as-is.
 */
function mimeEncodeSubject(subject: string): string {
  // eslint-disable-next-line no-control-regex
  if (/^[\x20-\x7E]*$/.test(subject)) return subject
  const encoded = Buffer.from(subject, 'utf8').toString('base64')
  return `=?UTF-8?B?${encoded}?=`
}
