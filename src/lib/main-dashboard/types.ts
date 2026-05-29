// Shared result shapes the CRM main dashboard components consume.

export interface DashboardMetrics {
  newDeals: number
  newDealsValue: number
  openDealsCount: number
  openDealsValue: number
  wonDeals: number
  wonDealsValue: number
  lostDeals: number
  lostDealsValue: number
}

export interface ReminderCountsBundle {
  today: number
  missed: number
  upcoming: number
}

export interface WonLostWeek {
  /** ISO week label e.g. "May 19" (start-of-week date) */
  label: string
  won: number
  lost: number
}

export interface UpcomingReminder {
  id: string
  title: string
  contactName: string | null
  reminderAt: string
  stageColor: string | null
  stageName: string | null
}

export interface RecentFollowup {
  id: string
  channel: string
  dealTitle: string
  contactName: string | null
  creatorName: string | null
  createdAt: string
}

export interface LeaderboardRow {
  profileId: string
  name: string
  email: string
  avatarUrl: string | null
  openDeals: number
  wonThisMonth: number
  valueWon: number
  followupsThisWeek: number
}
