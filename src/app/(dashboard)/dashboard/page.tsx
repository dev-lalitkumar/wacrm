"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canFilterAssignees, canViewTeamReports } from '@/lib/auth/permissions'
import { getVisibleProfileIds } from '@/lib/reports/visible-profiles'
import { getAssignableProfiles } from '@/lib/auth/assignable-profiles'
import type { Profile } from '@/types'
import {
  Briefcase,
  DollarSign,
  Trophy as TrophyIcon,
  XCircle,
} from 'lucide-react'

import {
  loadDashboardMetrics,
  loadReminderCounts,
  loadWonLostTrend,
  loadUpcomingReminders,
  loadRecentFollowups,
  loadTeamLeaderboard,
} from '@/lib/main-dashboard/queries'
import { loadPipelineDonut } from '@/lib/dashboard/queries'
import type { DashboardMetrics, WonLostWeek, UpcomingReminder, RecentFollowup, LeaderboardRow, ReminderCountsBundle } from '@/lib/main-dashboard/types'
import type { PipelineDonutData } from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { WonLostChart } from '@/components/main-dashboard/won-lost-chart'
import { UpcomingReminders } from '@/components/main-dashboard/upcoming-reminders'
import { RecentFollowups } from '@/components/main-dashboard/recent-followups'
import { TeamLeaderboard } from '@/components/main-dashboard/team-leaderboard'
import { ReminderCounts } from '@/components/main-dashboard/reminder-counts'

// ── Date range presets ────────────────────────────────────────────────────
type DateRange = 'today' | 'this_week' | 'this_month' | 'this_quarter' | 'this_year'

const DATE_RANGE_LABELS: Record<DateRange, string> = {
  today: 'Today',
  this_week: 'This Week',
  this_month: 'This Month',
  this_quarter: 'This Quarter',
  this_year: 'This Year',
}

function computeDateRange(range: DateRange): { start: string; end: string } {
  const now = new Date()
  const end = now.toISOString()

  switch (range) {
    case 'today': {
      const s = new Date(now); s.setHours(0, 0, 0, 0)
      return { start: s.toISOString(), end }
    }
    case 'this_week': {
      const s = new Date(now)
      const dow = s.getDay()
      const diff = dow === 0 ? 6 : dow - 1 // Monday start
      s.setDate(s.getDate() - diff)
      s.setHours(0, 0, 0, 0)
      return { start: s.toISOString(), end }
    }
    case 'this_month': {
      const s = new Date(now.getFullYear(), now.getMonth(), 1)
      return { start: s.toISOString(), end }
    }
    case 'this_quarter': {
      const qMonth = Math.floor(now.getMonth() / 3) * 3
      const s = new Date(now.getFullYear(), qMonth, 1)
      return { start: s.toISOString(), end }
    }
    case 'this_year': {
      const s = new Date(now.getFullYear(), 0, 1)
      return { start: s.toISOString(), end }
    }
  }
}

export default function DashboardPage() {
  const { profile } = useAuth()
  const showTeam = canViewTeamReports(profile?.role)
  const showUserFilter = canFilterAssignees(profile?.role ?? null)

  // ── Date range ─────────────────────────────────────────────
  const [dateRange, setDateRange] = useState<DateRange>('this_month')

  // ── User filter ────────────────────────────────────────────
  const [filterableProfiles, setFilterableProfiles] = useState<Profile[]>([])
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [visibleIds, setVisibleIds] = useState<string[] | null>(null)

  // The profile IDs to scope dashboard queries to
  const activeProfileIds = useMemo(() => {
    if (selectedUserId) return [selectedUserId]
    if (visibleIds) return visibleIds
    return undefined
  }, [selectedUserId, visibleIds])

  // ── Data states ────────────────────────────────────────────
  const [metrics, setMetrics] = useState<DashboardMetrics | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

  const [reminderCountsData, setReminderCountsData] = useState<ReminderCountsBundle | null>(null)
  const [reminderCountsLoading, setReminderCountsLoading] = useState(true)

  const [pipeline, setPipeline] = useState<PipelineDonutData | null>(null)
  const [pipelineLoading, setPipelineLoading] = useState(true)

  const [wonLost, setWonLost] = useState<WonLostWeek[] | null>(null)
  const [wonLostLoading, setWonLostLoading] = useState(true)

  const [reminders, setReminders] = useState<UpcomingReminder[] | null>(null)
  const [remindersLoading, setRemindersLoading] = useState(true)

  const [followups, setFollowups] = useState<RecentFollowup[] | null>(null)
  const [followupsLoading, setFollowupsLoading] = useState(true)

  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[] | null>(null)
  const [leaderboardLoading, setLeaderboardLoading] = useState(true)

  // ── Load filterable profiles + visible IDs ─────────────────
  useEffect(() => {
    if (!profile) return
    let cancelled = false
    ;(async () => {
      const db = createClient()
      const [assignable, visible] = await Promise.all([
        showUserFilter
          ? getAssignableProfiles(db, profile.id, profile.role ?? 'executive')
          : Promise.resolve([]),
        getVisibleProfileIds(db, profile.id, profile.role ?? 'executive'),
      ])
      if (!cancelled) {
        setFilterableProfiles(assignable)
        setVisibleIds(visible)
      }
    })()
    return () => { cancelled = true }
  }, [profile, showUserFilter])

  // ── Load all dashboard data ────────────────────────────────
  const loadAll = useCallback(() => {
    if (visibleIds === null) return // Wait until visible IDs are resolved

    const db = createClient()
    const { start, end } = computeDateRange(dateRange)
    const pIds = selectedUserId ? [selectedUserId] : visibleIds

    // Metrics (date-range-dependent)
    setMetricsLoading(true)
    void loadDashboardMetrics(db, start, end, pIds)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    // Reminder counts
    setReminderCountsLoading(true)
    void loadReminderCounts(db, pIds)
      .then((r) => setReminderCountsData(r))
      .catch((err) => console.error('[dashboard] reminder counts failed:', err))
      .finally(() => setReminderCountsLoading(false))

    // Pipeline donut
    setPipelineLoading(true)
    void loadPipelineDonut(db, pIds)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    // Won/Lost trend
    setWonLostLoading(true)
    void loadWonLostTrend(db, pIds)
      .then((w) => setWonLost(w))
      .catch((err) => console.error('[dashboard] won/lost failed:', err))
      .finally(() => setWonLostLoading(false))

    // Upcoming reminders
    setRemindersLoading(true)
    void loadUpcomingReminders(db, 8, pIds)
      .then((r) => setReminders(r))
      .catch((err) => console.error('[dashboard] reminders failed:', err))
      .finally(() => setRemindersLoading(false))

    // Recent followups
    setFollowupsLoading(true)
    void loadRecentFollowups(db, 8, pIds)
      .then((f) => setFollowups(f))
      .catch((err) => console.error('[dashboard] followups failed:', err))
      .finally(() => setFollowupsLoading(false))

    // Team leaderboard
    if (showTeam && profile) {
      setLeaderboardLoading(true)
      void loadTeamLeaderboard(db, visibleIds)
        .then((lb) => setLeaderboard(lb))
        .catch((err) => console.error('[dashboard] leaderboard failed:', err))
        .finally(() => setLeaderboardLoading(false))
    } else {
      setLeaderboardLoading(false)
    }
  }, [dateRange, selectedUserId, visibleIds, showTeam, profile])

  useEffect(() => {
    if (profile && visibleIds !== null) loadAll()
  }, [profile, visibleIds, loadAll])

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-400">
            Your CRM overview — deals, reminders, and team performance.
          </p>
        </div>

        {/* User filter — role-gated */}
        {showUserFilter && filterableProfiles.length > 0 && (
          <select
            value={selectedUserId ?? ''}
            onChange={(e) => setSelectedUserId(e.target.value || null)}
            className="h-9 rounded-lg border border-slate-700 bg-slate-900 px-3 text-sm text-white focus:border-primary focus:outline-none"
          >
            <option value="">All Users</option>
            {filterableProfiles.map((p) => (
              <option key={p.id} value={p.id}>
                {p.full_name || p.email}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Date range filter */}
      <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5 w-fit">
        {(Object.keys(DATE_RANGE_LABELS) as DateRange[]).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setDateRange(r)}
            className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
              dateRange === r
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {DATE_RANGE_LABELS[r]}
          </button>
        ))}
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="New Deals"
              value={String(metrics.newDeals)}
              icon={Briefcase}
              subtitle={`${formatCurrency(metrics.newDealsValue)} · ${DATE_RANGE_LABELS[dateRange]}`}
            />
            <MetricCard
              title="Open Deals"
              value={String(metrics.openDealsCount)}
              icon={DollarSign}
              subtitle={`${formatCurrency(metrics.openDealsValue)} · Current`}
            />
            <MetricCard
              title="Won Deals"
              value={String(metrics.wonDeals)}
              icon={TrophyIcon}
              subtitle={`${formatCurrency(metrics.wonDealsValue)} · ${DATE_RANGE_LABELS[dateRange]}`}
            />
            <MetricCard
              title="Lost Deals"
              value={String(metrics.lostDeals)}
              icon={XCircle}
              subtitle={`${formatCurrency(metrics.lostDealsValue)} · ${DATE_RANGE_LABELS[dateRange]}`}
            />
          </>
        )}
      </div>

      {/* Charts row — pipeline + won/lost */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="h-full lg:col-span-3">
          <PipelineDonut data={pipeline} loading={pipelineLoading} />
        </div>
        <div className="h-full lg:col-span-2">
          <WonLostChart data={wonLost} loading={wonLostLoading} />
        </div>
      </div>

      {/* Reminders + Followups */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <ReminderCounts data={reminderCountsData} loading={reminderCountsLoading} />
        <UpcomingReminders data={reminders} loading={remindersLoading} />
        <RecentFollowups data={followups} loading={followupsLoading} />
      </div>

      {/* Team Leaderboard — admin/owner/manager only */}
      {showTeam && (
        <TeamLeaderboard data={leaderboard} loading={leaderboardLoading} />
      )}
    </div>
  )
}

// ── Helpers ──────────────────────────────────────────────────────────────

function formatCurrency(v: number): string {
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v)
}
