import type { SupabaseClient } from '@supabase/supabase-js'
import { daysAgoStart } from '../dashboard/date-utils'
import type {
  DashboardMetrics,
  LeaderboardRow,
  RecentFollowup,
  ReminderCountsBundle,
  UpcomingReminder,
  WonLostWeek,
} from './types'

// All client-side aggregation. RLS scopes every query to the signed-in
// user automatically (same pattern as the WA dashboard queries).

type DB = SupabaseClient

// --- 1. Dashboard Metric cards -------------------------------------------

export async function loadDashboardMetrics(
  db: DB,
  rangeStart: string,
  rangeEnd: string,
  profileIds?: string[],
): Promise<DashboardMetrics> {
  // Build queries in parallel
  let newDealsQ = db
    .from('deals')
    .select('value')
    .gte('created_at', rangeStart)
    .lte('created_at', rangeEnd)
  let openDealsQ = db.from('deals').select('value').eq('status', 'open')
  let wonDealsQ = db
    .from('deals')
    .select('value')
    .eq('status', 'won')
    .gte('closed_at', rangeStart)
    .lte('closed_at', rangeEnd)
  let lostDealsQ = db
    .from('deals')
    .select('value')
    .eq('status', 'lost')
    .gte('closed_at', rangeStart)
    .lte('closed_at', rangeEnd)

  if (profileIds && profileIds.length > 0) {
    newDealsQ = newDealsQ.in('assigned_to', profileIds)
    openDealsQ = openDealsQ.in('assigned_to', profileIds)
    wonDealsQ = wonDealsQ.in('assigned_to', profileIds)
    lostDealsQ = lostDealsQ.in('assigned_to', profileIds)
  }

  const [newRes, openRes, wonRes, lostRes] = await Promise.all([
    newDealsQ,
    openDealsQ,
    wonDealsQ,
    lostDealsQ,
  ])

  const newRows = (newRes.data ?? []) as { value: number | null }[]
  const openRows = (openRes.data ?? []) as { value: number | null }[]
  const wonRows = (wonRes.data ?? []) as { value: number | null }[]
  const lostRows = (lostRes.data ?? []) as { value: number | null }[]

  return {
    newDeals: newRows.length,
    newDealsValue: newRows.reduce((s, d) => s + (d.value ?? 0), 0),
    openDealsCount: openRows.length,
    openDealsValue: openRows.reduce((s, d) => s + (d.value ?? 0), 0),
    wonDeals: wonRows.length,
    wonDealsValue: wonRows.reduce((s, d) => s + (d.value ?? 0), 0),
    lostDeals: lostRows.length,
    lostDealsValue: lostRows.reduce((s, d) => s + (d.value ?? 0), 0),
  }
}

// --- 2. Reminder counts --------------------------------------------------

export async function loadReminderCounts(
  db: DB,
  profileIds?: string[],
): Promise<ReminderCountsBundle> {
  let q = db
    .from('deals')
    .select('reminder_at')
    .eq('status', 'open')
    .not('reminder_at', 'is', null)

  if (profileIds && profileIds.length > 0) {
    q = q.in('assigned_to', profileIds)
  }

  const { data } = await q
  const rows = (data ?? []) as { reminder_at: string }[]

  const now = new Date()
  const todayEnd = new Date()
  todayEnd.setHours(23, 59, 59, 999)

  let today = 0
  let missed = 0
  let upcoming = 0

  for (const r of rows) {
    const dt = new Date(r.reminder_at)
    if (dt < now) missed++
    else if (dt <= todayEnd) today++
    else upcoming++
  }

  return { today, missed, upcoming }
}

// --- 3. Won vs Lost trend (8 weeks) -------------------------------------

export async function loadWonLostTrend(
  db: DB,
  profileIds?: string[],
): Promise<WonLostWeek[]> {
  const eightWeeksAgo = daysAgoStart(56).toISOString()

  let q = db
    .from('deals')
    .select('status, closed_at')
    .in('status', ['won', 'lost'])
    .not('closed_at', 'is', null)
    .gte('closed_at', eightWeeksAgo)

  if (profileIds && profileIds.length > 0) {
    q = q.in('assigned_to', profileIds)
  }

  const { data } = await q
  const rows = (data ?? []) as { status: string; closed_at: string }[]

  // Group by week (Monday-start)
  const weekBuckets = new Map<string, { won: number; lost: number }>()

  // Seed the last 8 weeks so empty weeks still render
  for (let i = 7; i >= 0; i--) {
    const d = daysAgoStart(i * 7)
    const dow = d.getDay()
    const diff = dow === 0 ? 6 : dow - 1
    d.setDate(d.getDate() - diff)
    const key = weekKey(d)
    if (!weekBuckets.has(key)) {
      weekBuckets.set(key, { won: 0, lost: 0 })
    }
  }

  for (const r of rows) {
    const d = new Date(r.closed_at)
    const dow = d.getDay()
    const diff = dow === 0 ? 6 : dow - 1
    d.setDate(d.getDate() - diff)
    const key = weekKey(d)
    const bucket = weekBuckets.get(key) ?? { won: 0, lost: 0 }
    if (r.status === 'won') bucket.won += 1
    else bucket.lost += 1
    weekBuckets.set(key, bucket)
  }

  return Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, counts]) => ({
      label: weekLabel(key),
      ...counts,
    }))
}

function weekKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekLabel(key: string): string {
  const d = new Date(key + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// --- 4. Upcoming reminders -----------------------------------------------

export async function loadUpcomingReminders(
  db: DB,
  limit = 8,
  profileIds?: string[],
): Promise<UpcomingReminder[]> {
  const nowIso = new Date().toISOString()

  let q = db
    .from('deals')
    .select(
      'id, title, reminder_at, contact:contacts(name), stage:pipeline_stages(name, color)',
    )
    .eq('status', 'open')
    .not('reminder_at', 'is', null)
    .gte('reminder_at', nowIso)
    .order('reminder_at', { ascending: true })
    .limit(limit)

  if (profileIds && profileIds.length > 0) {
    q = q.in('assigned_to', profileIds)
  }

  const { data } = await q

  return ((data ?? []) as unknown as Array<{
    id: string
    title: string
    reminder_at: string
    contact: { name: string | null } | { name: string | null }[] | null
    stage: { name: string; color: string } | { name: string; color: string }[] | null
  }>).map((d) => {
    const contact = Array.isArray(d.contact) ? d.contact[0] : d.contact
    const stage = Array.isArray(d.stage) ? d.stage[0] : d.stage
    return {
      id: d.id,
      title: d.title,
      contactName: contact?.name ?? null,
      reminderAt: d.reminder_at,
      stageColor: stage?.color ?? null,
      stageName: stage?.name ?? null,
    }
  })
}

// --- 5. Recent followups -------------------------------------------------

export async function loadRecentFollowups(
  db: DB,
  limit = 8,
  profileIds?: string[],
): Promise<RecentFollowup[]> {
  let q = db
    .from('deal_followups')
    .select(
      'id, channel, created_at, deal:deals(title, contact:contacts(name)), creator:profiles(full_name)',
    )
    .order('created_at', { ascending: false })
    .limit(limit)

  if (profileIds && profileIds.length > 0) {
    q = q.in('created_by', profileIds)
  }

  const { data } = await q

  return ((data ?? []) as unknown as Array<{
    id: string
    channel: string
    created_at: string
    deal: { title: string; contact: { name: string | null } | { name: string | null }[] | null } | null
    creator: { full_name: string | null } | { full_name: string | null }[] | null
  }>).map((f) => {
    const deal = Array.isArray(f.deal) ? f.deal[0] : f.deal
    const contact = deal ? (Array.isArray(deal.contact) ? deal.contact[0] : deal.contact) : null
    const creator = Array.isArray(f.creator) ? f.creator[0] : f.creator
    return {
      id: f.id,
      channel: f.channel,
      dealTitle: deal?.title ?? 'Untitled deal',
      contactName: contact?.name ?? null,
      creatorName: creator?.full_name ?? null,
      createdAt: f.created_at,
    }
  })
}

// --- 6. Team leaderboard (admin / manager only) --------------------------

export async function loadTeamLeaderboard(
  db: DB,
  visibleProfileIds: string[],
): Promise<LeaderboardRow[]> {
  if (visibleProfileIds.length === 0) return []

  const monthStart = (() => {
    const d = new Date()
    d.setDate(1)
    d.setHours(0, 0, 0, 0)
    return d.toISOString()
  })()
  const weekAgo = daysAgoStart(7).toISOString()

  const [profilesRes, openDealsRes, wonDealsRes, followupsRes] =
    await Promise.all([
      db
        .from('profiles')
        .select('id, full_name, email, avatar_url')
        .in('id', visibleProfileIds),
      db
        .from('deals')
        .select('assigned_to, id')
        .eq('status', 'open')
        .in('assigned_to', visibleProfileIds),
      db
        .from('deals')
        .select('assigned_to, value')
        .eq('status', 'won')
        .not('closed_at', 'is', null)
        .gte('closed_at', monthStart)
        .in('assigned_to', visibleProfileIds),
      db
        .from('deal_followups')
        .select('created_by, id')
        .gte('created_at', weekAgo)
        .in('created_by', visibleProfileIds),
    ])

  const profiles = (profilesRes.data ?? []) as Array<{
    id: string
    full_name: string | null
    email: string
    avatar_url: string | null
  }>

  const openByProfile = new Map<string, number>()
  for (const d of (openDealsRes.data ?? []) as Array<{ assigned_to: string | null }>) {
    if (d.assigned_to) openByProfile.set(d.assigned_to, (openByProfile.get(d.assigned_to) ?? 0) + 1)
  }

  const wonByProfile = new Map<string, { count: number; value: number }>()
  for (const d of (wonDealsRes.data ?? []) as Array<{
    assigned_to: string | null
    value: number | null
  }>) {
    if (d.assigned_to) {
      const prev = wonByProfile.get(d.assigned_to) ?? { count: 0, value: 0 }
      prev.count += 1
      prev.value += d.value ?? 0
      wonByProfile.set(d.assigned_to, prev)
    }
  }

  const followupsByProfile = new Map<string, number>()
  for (const f of (followupsRes.data ?? []) as Array<{ created_by: string | null }>) {
    if (f.created_by)
      followupsByProfile.set(f.created_by, (followupsByProfile.get(f.created_by) ?? 0) + 1)
  }

  return profiles
    .map((p) => {
      const won = wonByProfile.get(p.id) ?? { count: 0, value: 0 }
      return {
        profileId: p.id,
        name: p.full_name || p.email,
        email: p.email,
        avatarUrl: p.avatar_url,
        openDeals: openByProfile.get(p.id) ?? 0,
        wonThisMonth: won.count,
        valueWon: won.value,
        followupsThisWeek: followupsByProfile.get(p.id) ?? 0,
      }
    })
    .sort((a, b) => b.wonThisMonth - a.wonThisMonth || b.valueWon - a.valueWon)
}
