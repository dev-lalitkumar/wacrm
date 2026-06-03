'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { timeAgo } from '@/lib/utils'
import { Loader2, ShieldCheck } from 'lucide-react'

interface AuditEntry {
  id: string
  actor_name: string | null
  action: string
  entity_type: string | null
  detail: Record<string, unknown>
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  'user.role_changed': 'Changed a user role',
  'user.deactivated': 'Deactivated a user',
  'user.updated': 'Updated a user',
  'contact.merged': 'Merged contacts',
}

function describe(e: AuditEntry): string {
  const d = e.detail ?? {}
  if (e.action === 'user.role_changed') {
    const before = (d.before as { role?: string })?.role
    const after = (d.after as { role?: string })?.role
    return `${(d.target_name as string) ?? 'A user'}: ${before ?? '—'} → ${after ?? '—'}`
  }
  if (e.action === 'user.deactivated') return `${(d.target_name as string) ?? 'A user'} deactivated`
  if (e.action === 'contact.merged') return `Merged a duplicate into a surviving contact`
  return e.entity_type ?? ''
}

export function AuditLog() {
  const supabase = createClient()
  const [entries, setEntries] = useState<AuditEntry[]>([])
  const [loading, setLoading] = useState(true)

  const fetchEntries = useCallback(async () => {
    setLoading(true)
    const { data } = await supabase
      .from('audit_log')
      .select('id, actor_name, action, entity_type, detail, created_at')
      .order('created_at', { ascending: false })
      .limit(100)
    setEntries((data ?? []) as AuditEntry[])
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchEntries()
  }, [fetchEntries])

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <ShieldCheck className="size-4 text-primary" /> Audit Log
        </h2>
        <p className="text-xs text-slate-500">
          Sensitive team actions — role changes, deactivations, and contact merges. Most recent 100.
        </p>
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : entries.length === 0 ? (
          <p className="py-10 text-center text-sm text-slate-500">No audit entries yet.</p>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {entries.map((e) => (
              <li key={e.id} className="flex items-start gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-slate-200">
                    {ACTION_LABELS[e.action] ?? e.action}
                  </p>
                  <p className="text-xs text-slate-500">{describe(e)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-400">{e.actor_name || 'System'}</p>
                  <p className="text-[10px] text-slate-600">{timeAgo(e.created_at)}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
