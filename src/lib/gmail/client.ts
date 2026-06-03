/**
 * Gmail API client — token management, send, and fetch.
 *
 * All calls use native fetch(). No external dependencies.
 * Tokens are encrypted at rest in the `gmail_config` singleton table
 * using the shared AES-256-GCM module.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { encrypt, decrypt } from '@/lib/encryption'
import { buildMimeMessage, mimeToBase64Url } from './mime'
import type {
  GmailTokens,
  GmailSendOptions,
  GmailSendResult,
  GmailMessageMeta,
  GmailUserInfo,
  TokenRefreshResult,
} from './types'

const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GMAIL_API_BASE = 'https://gmail.googleapis.com/gmail/v1/users/me'

// ── OAuth helpers ───────────────────────────────────────────────

/**
 * Build the Google OAuth consent URL.
 */
export function getOAuthUrl(redirectUri: string): string {
  const clientId = process.env.GOOGLE_CLIENT_ID
  if (!clientId) throw new Error('GOOGLE_CLIENT_ID env var is not set')

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'https://www.googleapis.com/auth/gmail.send https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.profile',
    access_type: 'offline',
    prompt: 'consent',
    include_granted_scopes: 'true',
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

/**
 * Exchange an authorization code for tokens.
 */
export async function exchangeCodeForTokens(
  code: string,
  redirectUri: string,
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number; scope: string }> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars are required')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token exchange failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresIn: data.expires_in,
    scope: data.scope,
  }
}

/**
 * Refresh an expired access token using the refresh token.
 */
async function refreshAccessToken(refreshToken: string): Promise<TokenRefreshResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET env vars are required')
  }

  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Token refresh failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in,
  }
}

// ── Token management ────────────────────────────────────────────

/**
 * Fetch and decrypt Gmail tokens from the singleton config row.
 * Automatically refreshes if the access token is expired, writing the
 * new token back to the DB.
 */
export async function getGmailTokens(db: SupabaseClient): Promise<GmailTokens & { email: string }> {
  const { data: config, error } = await db
    .from('gmail_config')
    .select('access_token, refresh_token, token_expiry, connected_email, status')
    .eq('id', 1)
    .single()

  if (error || !config) throw new Error('Gmail config not found')
  if (config.status !== 'connected') throw new Error('Gmail is not connected')
  if (!config.access_token || !config.refresh_token) {
    throw new Error('Gmail tokens are missing')
  }

  let accessToken = decrypt(config.access_token)
  const refreshToken = decrypt(config.refresh_token)
  const expiresAt = config.token_expiry ? new Date(config.token_expiry) : null

  // Refresh if expired or expiring within 5 minutes
  const needsRefresh = !expiresAt || expiresAt.getTime() - Date.now() < 5 * 60 * 1000
  if (needsRefresh) {
    try {
      const refreshed = await refreshAccessToken(refreshToken)
      accessToken = refreshed.accessToken

      const newExpiry = new Date(Date.now() + refreshed.expiresIn * 1000)
      await db
        .from('gmail_config')
        .update({
          access_token: encrypt(refreshed.accessToken),
          token_expiry: newExpiry.toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', 1)
    } catch (err) {
      // If refresh fails, mark config as error
      await db
        .from('gmail_config')
        .update({ status: 'error', updated_at: new Date().toISOString() })
        .eq('id', 1)
      throw err
    }
  }

  return {
    accessToken,
    refreshToken,
    expiresAt,
    email: config.connected_email ?? '',
  }
}

// ── Gmail API calls ─────────────────────────────────────────────

/**
 * Get the authenticated user's Gmail profile info.
 */
export async function getGmailProfile(accessToken: string): Promise<GmailUserInfo> {
  const res = await fetch(`${GMAIL_API_BASE}/profile`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail profile fetch failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return {
    email: data.emailAddress,
    messagesTotal: data.messagesTotal,
    threadsTotal: data.threadsTotal,
  }
}

/**
 * Fetch the connected Google account's profile (display name + picture).
 * Requires the `userinfo.profile` scope. Best-effort — callers should treat
 * a failure as "name/picture unavailable" rather than fatal.
 */
export async function getGoogleUserInfo(
  accessToken: string,
): Promise<{ name: string | null; picture: string | null; email: string | null }> {
  const res = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google userinfo fetch failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  return {
    name: data.name ?? null,
    picture: data.picture ?? null,
    email: data.email ?? null,
  }
}

/**
 * Send an email via the Gmail API.
 */
export async function sendEmail(
  accessToken: string,
  opts: GmailSendOptions,
): Promise<GmailSendResult> {
  const mime = buildMimeMessage({
    from: opts.from,
    to: opts.to,
    cc: opts.cc,
    bcc: opts.bcc,
    subject: opts.subject,
    bodyText: opts.bodyText,
    bodyHtml: opts.bodyHtml,
    inReplyTo: opts.inReplyTo,
  })

  const raw = mimeToBase64Url(mime)

  const body: Record<string, string> = { raw }
  if (opts.threadId) body.threadId = opts.threadId

  const res = await fetch(`${GMAIL_API_BASE}/messages/send`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Gmail send failed (${res.status}): ${text}`)
  }

  const data = await res.json()
  return {
    messageId: data.id,
    threadId: data.threadId,
  }
}

/**
 * Fetch recent emails from the inbox. Used by the notifications
 * polling endpoint.
 */
export async function fetchRecentEmails(
  accessToken: string,
  opts: { maxResults?: number; afterTimestamp?: string },
): Promise<GmailMessageMeta[]> {
  const maxResults = opts.maxResults ?? 20

  // Build search query
  let q = 'in:inbox'
  if (opts.afterTimestamp) {
    // Gmail search uses epoch seconds
    const epoch = Math.floor(new Date(opts.afterTimestamp).getTime() / 1000)
    q += ` after:${epoch}`
  }

  const params = new URLSearchParams({
    q,
    maxResults: String(maxResults),
  })

  const listRes = await fetch(`${GMAIL_API_BASE}/messages?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })
  if (!listRes.ok) {
    const text = await listRes.text()
    throw new Error(`Gmail list failed (${listRes.status}): ${text}`)
  }

  const listData = await listRes.json()
  const messageIds: Array<{ id: string; threadId: string }> = listData.messages ?? []
  if (messageIds.length === 0) return []

  // Fetch metadata for each message (batch would be better at scale,
  // but for MVP the serial approach is fine for ≤20 messages)
  const results: GmailMessageMeta[] = []
  for (const msg of messageIds) {
    try {
      const metaRes = await fetch(
        `${GMAIL_API_BASE}/messages/${msg.id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      )
      if (!metaRes.ok) continue
      const meta = await metaRes.json()

      const headers: Array<{ name: string; value: string }> = meta.payload?.headers ?? []
      const fromHeader = headers.find((h) => h.name === 'From')?.value ?? ''
      const subjectHeader = headers.find((h) => h.name === 'Subject')?.value ?? null
      const dateHeader = headers.find((h) => h.name === 'Date')?.value ?? ''

      // Parse "Name <email>" format
      const fromMatch = fromHeader.match(/^(.+?)\s*<(.+?)>$/)
      const fromName = fromMatch ? fromMatch[1].replace(/"/g, '').trim() : null
      const fromEmail = fromMatch ? fromMatch[2] : fromHeader

      results.push({
        id: meta.id,
        threadId: meta.threadId,
        from: fromEmail,
        fromName,
        subject: subjectHeader,
        snippet: meta.snippet ?? '',
        date: dateHeader ? new Date(dateHeader).toISOString() : new Date().toISOString(),
      })
    } catch {
      // Skip individual message errors
      continue
    }
  }

  return results
}
