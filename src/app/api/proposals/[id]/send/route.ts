import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isErrorResponse, requireRole } from '@/lib/auth/require-role'
import { dispatchNotification } from '@/lib/notifications/service'
import { interpolate } from '@/lib/proposals/template-interpolator'
import { advanceDealToProposalSent } from '@/lib/deals/service'
import { getGmailTokens, sendEmail } from '@/lib/gmail/client'
import { sendTextMessage } from '@/lib/whatsapp/meta-api'

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency || 'USD',
    minimumFractionDigits: 0,
  }).format(amount)
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const callerOrError = await requireRole(['admin', 'owner', 'manager', 'executive'])
  if (isErrorResponse(callerOrError)) return callerOrError
  const caller = callerOrError

  const { id } = await params
  let body: Record<string, unknown>
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const channel = body.channel as 'email' | 'whatsapp' | undefined
  if (!channel) return NextResponse.json({ error: 'channel is required' }, { status: 400 })

  const supabase = await createClient()

  const { data: proposal, error: fetchError } = await supabase
    .from('proposals')
    .select('*, contact:contacts(id, name, email, phone)')
    .eq('id', id)
    .single()

  if (fetchError || !proposal) return NextResponse.json({ error: 'Proposal not found' }, { status: 404 })

  const appUrl = process.env.NEXT_PUBLIC_APP_URL
    ?? (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000')
  const proposalLink = `${appUrl}/p/${proposal.public_token}`

  const vars = {
    contact_name: (proposal.contact as { name?: string } | null)?.name ?? 'there',
    proposal_title: proposal.title,
    proposal_link: proposalLink,
    total_amount: formatMoney(proposal.total_amount, proposal.currency),
    valid_until: proposal.valid_until
      ? new Date(proposal.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A',
  }

  const messageBody = body.message ? interpolate(String(body.message), vars) : ''
  let recipient = ''

  try {
    if (channel === 'email') {
      const contact = proposal.contact as { email?: string } | null
      const toEmail = contact?.email
      if (!toEmail) return NextResponse.json({ error: 'Contact has no email address' }, { status: 400 })
      recipient = toEmail

      const subject = body.subject
        ? interpolate(String(body.subject), vars)
        : `Proposal: ${proposal.title}`

      // Check Gmail connection before attempting to fetch tokens — gives a
      // clear 400 instead of a cryptic 500 if Gmail isn't set up.
      const { data: gmailConfig } = await supabase
        .from('gmail_config')
        .select('status')
        .eq('id', 1)
        .maybeSingle()
      if (gmailConfig?.status !== 'connected') {
        return NextResponse.json(
          { error: 'Gmail is not connected. Connect Gmail in Settings → Email before sending proposals.' },
          { status: 400 },
        )
      }

      const tokens = await getGmailTokens(supabase)

      // Log first
      const { data: logEntry } = await supabase
        .from('email_logs')
        .insert({
          from_email: tokens.email,
          to_emails: [toEmail],
          subject,
          body_text: messageBody,
          contact_id: proposal.contact_id ?? null,
          deal_id: proposal.deal_id ?? null,
          sent_by: caller.profileId,
          status: 'sending',
        })
        .select('id')
        .single()

      const result = await sendEmail(tokens.accessToken, {
        from: tokens.email,
        to: [toEmail],
        subject,
        bodyText: messageBody,
      })

      if (logEntry) {
        await supabase
          .from('email_logs')
          .update({ gmail_message_id: result.messageId, gmail_thread_id: result.threadId, status: 'sent' })
          .eq('id', logEntry.id)
      }
    } else {
      // WhatsApp
      const contact = proposal.contact as { phone?: string } | null
      const phone = contact?.phone
      if (!phone) return NextResponse.json({ error: 'Contact has no phone number' }, { status: 400 })
      recipient = phone

      const { getDecryptedWhatsAppCredentials } = await import('@/lib/whatsapp/credentials')
      const creds = await getDecryptedWhatsAppCredentials()
      if (!creds?.canMessage) {
        return NextResponse.json({ error: 'WhatsApp is not configured' }, { status: 400 })
      }

      await sendTextMessage({
        phoneNumberId: creds.phoneNumberId,
        accessToken: creds.accessToken,
        to: phone,
        text: messageBody,
      })
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to send'
    return NextResponse.json({ error: message }, { status: 500 })
  }

  // Mark proposal as sent
  await supabase
    .from('proposals')
    .update({
      status: 'sent',
      sent_at: new Date().toISOString(),
      sent_by: caller.profileId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)

  // Record in history
  await supabase.from('proposal_history').insert({
    proposal_id: id,
    action: 'sent',
    channel,
    actor_id: caller.profileId,
    recipient,
  })

  // Advance the linked deal to its "Proposal Sent" stage — only if it's open
  // and currently behind that stage (never moves backwards). Best-effort: a
  // missing deal or stage must never fail the send that already succeeded.
  if (proposal.deal_id) {
    const { changed, stageId } = await advanceDealToProposalSent(supabase, proposal.deal_id)
    if (changed && stageId) {
      dispatchNotification({
        type: 'deal.stage_changed',
        dealId: proposal.deal_id,
        stageId,
      }).catch((err) => console.error('[POST /api/proposals/:id/send] notify', err))
    }
  }

  return NextResponse.json({ ok: true })
}
