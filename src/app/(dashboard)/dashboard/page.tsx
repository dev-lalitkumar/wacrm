"use client"

import { useCallback, useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canViewTeamReports } from '@/lib/auth/permissions'
import { getVisibleProfileIds } from '@/lib/reports/visible-profiles'
import {
  Users,
  DollarSign,
  Trophy as TrophyIcon,
  AlertTriangle,
} from 'lucide-react'

import {
  loadCrmMetrics,
  loadWonLostTrend,
  loadUpcomingReminders,
  loadRecentFollowups,
  loadTeamLeaderboard,
} from '@/lib/main-dashboard/queries'
import { loadPipelineDonut } from '@/lib/dashboard/queries'
import type { CrmMetricsBundle, WonLostWeek, UpcomingReminder, RecentFollowup, LeaderboardRow } from '@/lib/main-dashboard/types'
import type { PipelineDonutData } from '@/lib/dashboard/types'

import { MetricCard } from '@/components/dashboard/metric-card'
import { SkeletonCard } from '@/components/dashboard/skeleton'
import { PipelineDonut } from '@/components/dashboard/pipeline-donut'
import { WonLostChart } from '@/components/main-dashboard/won-lost-chart'
import { UpcomingReminders } from '@/components/main-dashboard/upcoming-reminders'
import { RecentFollowups } from '@/components/main-dashboard/recent-followups'
import { TeamLeaderboard } from '@/components/main-dashboard/team-leaderboard'
import { EmailNotifications } from '@/components/main-dashboard/email-notifications'
import { useGmailStatus } from '@/hooks/use-gmail-status'

export default function DashboardPage() {
  const { profile } = useAuth()
  const showTeam = canViewTeamReports(profile?.role)
  const gmail = useGmailStatus()

  const [metrics, setMetrics] = useState<CrmMetricsBundle | null>(null)
  const [metricsLoading, setMetricsLoading] = useState(true)

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

  const loadAll = useCallback(() => {
    const db = createClient()

    // Kick off all independent queries in parallel — each widget shows
    // its own skeleton while loading.
    void loadCrmMetrics(db)
      .then((m) => setMetrics(m))
      .catch((err) => console.error('[dashboard] crm metrics failed:', err))
      .finally(() => setMetricsLoading(false))

    void loadPipelineDonut(db)
      .then((p) => setPipeline(p))
      .catch((err) => console.error('[dashboard] pipeline failed:', err))
      .finally(() => setPipelineLoading(false))

    void loadWonLostTrend(db)
      .then((w) => setWonLost(w))
      .catch((err) => console.error('[dashboard] won/lost failed:', err))
      .finally(() => setWonLostLoading(false))

    void loadUpcomingReminders(db)
      .then((r) => setReminders(r))
      .catch((err) => console.error('[dashboard] reminders failed:', err))
      .finally(() => setRemindersLoading(false))

    void loadRecentFollowups(db)
      .then((f) => setFollowups(f))
      .catch((err) => console.error('[dashboard] followups failed:', err))
      .finally(() => setFollowupsLoading(false))

    // Team leaderboard — only for admin/owner/manager
    if (showTeam && profile) {
      void getVisibleProfileIds(db, profile.id, profile.role ?? 'executive')
        .then((ids) => loadTeamLeaderboard(db, ids))
        .then((lb) => setLeaderboard(lb))
        .catch((err) => console.error('[dashboard] leaderboard failed:', err))
        .finally(() => setLeaderboardLoading(false))
    } else {
      setLeaderboardLoading(false)
    }
  }, [showTeam, profile])

  useEffect(() => {
    if (profile) loadAll()
  }, [profile, loadAll])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-400">
          Your CRM overview — contacts, deals, reminders, and team performance.
        </p>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {metricsLoading || !metrics ? (
          Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
        ) : (
          <>
            <MetricCard
              title="Total Contacts"
              value={metrics.totalContacts.toLocaleString()}
              icon={Users}
              delta={{
                sign: metrics.newContactsThisWeek,
                label: `+${metrics.newContactsThisWeek} this week`,
              }}
            />
            <MetricCard
              title="Open Deals"
              value={formatCurrency(metrics.openDealsValue)}
              icon={DollarSign}
              subtitle={`${metrics.openDealsCount} open deal${metrics.openDealsCount === 1 ? '' : 's'}`}
            />
            <MetricCard
              title="Won This Month"
              value={formatCurrency(metrics.wonThisMonthValue)}
              icon={TrophyIcon}
              subtitle={`${metrics.wonThisMonthCount} deal${metrics.wonThisMonthCount === 1 ? '' : 's'} won`}
            />
            <MetricCard
              title="Overdue Reminders"
              value={metrics.overdueReminders.toLocaleString()}
              icon={AlertTriangle}
              subtitle={
                metrics.overdueReminders > 0
                  ? 'Needs attention'
                  : 'All caught up!'
              }
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
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <UpcomingReminders data={reminders} loading={remindersLoading} />
        <RecentFollowups data={followups} loading={followupsLoading} />
      </div>

      {/* Email Notifications — only when Gmail connected */}
      <EmailNotifications connected={gmail.connected} />

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
