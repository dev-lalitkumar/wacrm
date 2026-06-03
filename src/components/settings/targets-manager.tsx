'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canManageTargets } from '@/lib/auth/permissions'
import { ROLE_LABEL } from '@/lib/auth/permissions'
import type { Role } from '@/lib/auth/require-role'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Loader2, Target as TargetIcon, Save } from 'lucide-react'
import { toast } from 'sonner'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string
  role: string
}

/** Current month as YYYY-MM for the <input type="month">. */
function currentMonth() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

export function TargetsManager() {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageTargets(profile?.role ?? null)

  const [month, setMonth] = useState(currentMonth())
  const [profiles, setProfiles] = useState<ProfileRow[]>([])
  // profileId -> input value (string for controlled inputs)
  const [values, setValues] = useState<Record<string, string>>({})
  const [original, setOriginal] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchData = useCallback(async () => {
    setLoading(true)
    const [profilesRes, targetsRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('id, full_name, email, role')
        .eq('is_active', true)
        .in('role', ['owner', 'manager', 'executive'])
        .order('full_name'),
      fetch(`/api/targets?month=${month}`).then((r) => r.json()).catch(() => ({ targets: [] })),
    ])

    const profs = (profilesRes.data ?? []) as ProfileRow[]
    const targets = (targetsRes.targets ?? []) as { profile_id: string; target_value: number; metric: string }[]

    const map: Record<string, string> = {}
    targets
      .filter((t) => t.metric === 'revenue_won')
      .forEach((t) => {
        map[t.profile_id] = String(t.target_value ?? 0)
      })

    setProfiles(profs)
    setValues(map)
    setOriginal(map)
    setLoading(false)
  }, [supabase, month])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData()
  }, [fetchData])

  const dirtyIds = profiles
    .map((p) => p.id)
    .filter((id) => (values[id] ?? '') !== (original[id] ?? ''))

  async function handleSaveAll() {
    if (dirtyIds.length === 0) return
    setSaving(true)
    let ok = 0
    let failed = 0
    for (const id of dirtyIds) {
      const raw = values[id] ?? ''
      const num = raw === '' ? 0 : Number(raw)
      if (!Number.isFinite(num) || num < 0) {
        failed++
        continue
      }
      const res = await fetch('/api/targets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          profile_id: id,
          period_month: `${month}-01`,
          metric: 'revenue_won',
          target_value: num,
        }),
      })
      if (res.ok) ok++
      else failed++
    }
    setSaving(false)
    if (ok > 0) toast.success(`Saved ${ok} target${ok === 1 ? '' : 's'}`)
    if (failed > 0) toast.error(`${failed} target${failed === 1 ? '' : 's'} failed to save`)
    fetchData()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <TargetIcon className="size-4 text-primary" /> Sales Targets
          </h2>
          <p className="text-xs text-slate-500 max-w-lg">
            Set a monthly <span className="text-slate-400">won-revenue</span> target for each rep.
            Attainment (actual ÷ target) shows up on the Employee report and dashboard.
          </p>
        </div>
        <div className="space-y-1">
          <Label className="text-slate-400 text-xs">Month</Label>
          <Input
            type="month"
            value={month}
            onChange={(e) => setMonth(e.target.value)}
            className="h-9 w-40 bg-slate-800 border-slate-700 text-white [color-scheme:dark]"
          />
        </div>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : profiles.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">No team members found.</div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {profiles.map((p) => (
              <li key={p.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-200 truncate">
                    {p.full_name || p.email}
                  </p>
                  <p className="text-[10px] text-slate-500">{ROLE_LABEL[p.role as Role] ?? p.role}</p>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-slate-500">USD</span>
                  <Input
                    type="number"
                    min={0}
                    step={100}
                    inputMode="decimal"
                    disabled={!canManage}
                    value={values[p.id] ?? ''}
                    onChange={(e) => setValues((v) => ({ ...v, [p.id]: e.target.value }))}
                    placeholder="0"
                    className="h-8 w-32 bg-slate-800 border-slate-700 text-white text-right disabled:opacity-60"
                  />
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {canManage ? (
        <div className="flex justify-end">
          <Button
            onClick={handleSaveAll}
            disabled={saving || dirtyIds.length === 0}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save{dirtyIds.length > 0 ? ` (${dirtyIds.length})` : ''}
          </Button>
        </div>
      ) : (
        <p className="text-xs text-slate-500">
          Only admins, owners, and managers can set targets.
        </p>
      )}
    </div>
  )
}
