// Internal types for the Gmail API client layer.

export interface GmailTokens {
  accessToken: string
  refreshToken: string
  expiresAt: Date | null
}

export interface GmailSendOptions {
  from: string
  to: string[]
  cc?: string[]
  bcc?: string[]
  subject: string
  bodyText?: string
  bodyHtml?: string
  /** Gmail message ID to reply to (sets In-Reply-To header). */
  inReplyTo?: string
  /** Gmail thread ID to keep the reply in the same thread. */
  threadId?: string
}

export interface GmailSendResult {
  messageId: string
  threadId: string
}

export interface GmailMessageMeta {
  id: string
  threadId: string
  from: string
  fromName: string | null
  subject: string | null
  snippet: string
  date: string // ISO timestamp
}

export interface GmailUserInfo {
  email: string
  messagesTotal: number
  threadsTotal: number
}

export interface TokenRefreshResult {
  accessToken: string
  expiresIn: number
}
