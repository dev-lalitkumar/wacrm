import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailTokens, sendEmail } from '@/lib/gmail/client'

/**
 * POST /api/gmail/send
 *
 * Send an email via the connected Gmail account.
 * Any authenticated user can send (RLS scopes their contacts/deals).
 *
 * Body: {
 *   to: string | string[],
 *   subject: string,
 *   body_text?: string,
 *   body_html?: string,
 *   cc?: string[],
 *   bcc?: string[],
 *   contact_id?: string,
 *   deal_id?: string,
 *   thread_id?: string,     // for replies
 *   in_reply_to?: string,   // Gmail message ID to thread as reply
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get caller's profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('user_id', user.id)
      .single()

    if (!profile) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      to,
      subject,
      body_text,
      body_html,
      cc,
      bcc,
      contact_id,
      deal_id,
      thread_id,
      in_reply_to,
    } = body

    // Validate required fields
    const toEmails = Array.isArray(to) ? to : [to]
    if (!toEmails.length || !toEmails.every((e: string) => e.includes('@'))) {
      return NextResponse.json(
        { error: 'Valid recipient email(s) required' },
        { status: 400 },
      )
    }
    if (!subject?.trim()) {
      return NextResponse.json(
        { error: 'Subject is required' },
        { status: 400 },
      )
    }
    if (!body_text?.trim() && !body_html?.trim()) {
      return NextResponse.json(
        { error: 'Email body is required' },
        { status: 400 },
      )
    }

    // Get Gmail tokens (auto-refreshes if expired)
    const tokens = await getGmailTokens(supabase)

    // Insert a "sending" log entry first
    const { data: logEntry, error: logError } = await supabase
      .from('email_logs')
      .insert({
        from_email: tokens.email,
        to_emails: toEmails,
        cc_emails: cc ?? null,
        bcc_emails: bcc ?? null,
        subject: subject.trim(),
        body_text: body_text?.trim() ?? null,
        body_html: body_html?.trim() ?? null,
        contact_id: contact_id ?? null,
        deal_id: deal_id ?? null,
        sent_by: profile.id,
        status: 'sending',
      })
      .select('id')
      .single()

    if (logError) {
      console.error('[gmail/send] Log insert error:', logError)
      // Non-fatal — continue sending
    }

    let result: Awaited<ReturnType<typeof sendEmail>>
    try {
      // Send via Gmail API
      result = await sendEmail(tokens.accessToken, {
        from: tokens.email,
        to: toEmails,
        cc,
        bcc,
        subject: subject.trim(),
        bodyText: body_text?.trim(),
        bodyHtml: body_html?.trim(),
        threadId: thread_id,
        inReplyTo: in_reply_to,
      })
    } catch (sendErr) {
      // Mark log as failed so it never stays stuck in 'sending'.
      if (logEntry) {
        await supabase
          .from('email_logs')
          .update({ status: 'failed' })
          .eq('id', logEntry.id)
          .then() // fire-and-forget; don't let a log error mask the real error
      }
      throw sendErr // re-throw to outer catch → 500 response
    }

    // Update log entry with success — in its own try/catch so a DB hiccup
    // here doesn't roll back an already-delivered email.
    if (logEntry) {
      try {
        await supabase
          .from('email_logs')
          .update({
            gmail_message_id: result.messageId,
            gmail_thread_id: result.threadId,
            status: 'sent',
          })
          .eq('id', logEntry.id)
      } catch (logUpdateErr) {
        console.error('[gmail/send] failed to update log to sent:', logUpdateErr)
      }
    }

    // Auto-log a followup if contact_id is provided
    if (contact_id) {
      const row: Record<string, unknown> = {
        contact_id,
        channel: 'email',
        note: `Email sent: "${subject.trim()}" to ${toEmails.join(', ')}`,
        created_by: profile.id,
      }
      if (deal_id) row.deal_id = deal_id

      await supabase.from('followups').insert(row)
    }

    return NextResponse.json({
      success: true,
      message_id: result.messageId,
      thread_id: result.threadId,
      log_id: logEntry?.id ?? null,
    })
  } catch (err) {
    console.error('[gmail/send] error:', err)
    const message =
      err instanceof Error ? err.message : 'Failed to send email'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
