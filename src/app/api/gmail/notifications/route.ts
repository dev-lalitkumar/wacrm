import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getGmailTokens, fetchRecentEmails } from '@/lib/gmail/client'

/**
 * GET /api/gmail/notifications?since=<ISO timestamp>
 *
 * Poll-on-load endpoint: fetches recent inbound emails, matches them
 * to known contacts by email address, and caches in email_notifications.
 * Returns the notifications + unread count.
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check Gmail connection
    const { data: config } = await supabase
      .from('gmail_config')
      .select('status')
      .eq('id', 1)
      .maybeSingle()

    if (!config || config.status !== 'connected') {
      return NextResponse.json({
        notifications: [],
        unread_count: 0,
        connected: false,
      })
    }

    const since =
      request.nextUrl.searchParams.get('since') ??
      new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

    // Get tokens (auto-refreshes)
    const tokens = await getGmailTokens(supabase)

    // Fetch recent emails from Gmail
    const emails = await fetchRecentEmails(tokens.accessToken, {
      maxResults: 20,
      afterTimestamp: since,
    })

    // Build a map of known contact emails for matching
    const fromEmails = [...new Set(emails.map((e) => e.from.toLowerCase()))]
    const { data: contacts } = await supabase
      .from('contacts')
      .select('id, email')
      .not('email', 'is', null)

    const contactByEmail = new Map<string, string>()
    for (const c of (contacts ?? []) as Array<{ id: string; email: string | null }>) {
      if (c.email) contactByEmail.set(c.email.toLowerCase(), c.id)
    }

    // Upsert notifications (dedupe by gmail_message_id)
    for (const email of emails) {
      const contactId = contactByEmail.get(email.from.toLowerCase()) ?? null

      await supabase
        .from('email_notifications')
        .upsert(
          {
            gmail_message_id: email.id,
            gmail_thread_id: email.threadId,
            from_email: email.from,
            from_name: email.fromName,
            subject: email.subject,
            snippet: email.snippet,
            contact_id: contactId,
            received_at: email.date,
          },
          { onConflict: 'gmail_message_id' },
        )
    }

    // Fetch back the notifications with contact joins
    const { data: notifications } = await supabase
      .from('email_notifications')
      .select('*, contact:contacts(id, name, email, phone)')
      .gte('received_at', since)
      .order('received_at', { ascending: false })
      .limit(20)

    // Count unread
    const { count: unreadCount } = await supabase
      .from('email_notifications')
      .select('id', { count: 'exact', head: true })
      .eq('is_read', false)

    return NextResponse.json({
      notifications: notifications ?? [],
      unread_count: unreadCount ?? 0,
      connected: true,
    })
  } catch (err) {
    console.error('[gmail/notifications] error:', err)
    return NextResponse.json(
      { error: 'Failed to fetch notifications' },
      { status: 500 },
    )
  }
}

/**
 * POST /api/gmail/notifications
 *
 * Mark a notification as read.
 * Body: { notification_id: string }
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

    const { notification_id } = await request.json()
    if (!notification_id) {
      return NextResponse.json(
        { error: 'notification_id is required' },
        { status: 400 },
      )
    }

    await supabase
      .from('email_notifications')
      .update({ is_read: true })
      .eq('id', notification_id)

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error('[gmail/notifications] POST error:', err)
    return NextResponse.json(
      { error: 'Failed to update notification' },
      { status: 500 },
    )
  }
}
