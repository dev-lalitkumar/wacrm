'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { canManageCompany } from '@/lib/auth/permissions'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Loader2, Timer } from 'lucide-react'
import { toast } from 'sonner'

export function SlaSettings() {
  const { profile } = useAuth()
  const canManage = canManageCompany(profile?.role ?? null) // admin/owner

  const [enabled, setEnabled] = useState(true)
  const [minutes, setMinutes] = useState('15')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const fetchSettings = useCallback(async () => {
    setLoading(true)
    const res = await fetch('/api/sla-settings')
    const json = await res.json().catch(() => null)
    if (json?.settings) {
      setEnabled(Boolean(json.settings.enabled))
      setMinutes(String(json.settings.first_response_minutes ?? 15))
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSettings()
  }, [fetchSettings])

  async function handleSave() {
    const mins = Number(minutes)
    if (!Number.isInteger(mins) || mins < 1) {
      toast.error('Response time must be a whole number of minutes (≥ 1)')
      return
    }
    setSaving(true)
    const res = await fetch('/api/sla-settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled, first_response_minutes: mins }),
    })
    setSaving(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: '' }))
      toast.error(error || 'Failed to save SLA settings')
      return
    }
    toast.success('SLA settings saved')
    fetchSettings()
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800/40 p-5 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-white flex items-center gap-2">
          <Timer className="size-4 text-primary" /> First-Response SLA
        </h2>
        <p className="text-xs text-slate-500 max-w-xl mt-1">
          When a new lead has no response within this window, the assigned rep and their
          managers are alerted. Disable it, or raise the limit, if escalations feel too noisy.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center py-4">
          <Loader2 className="size-5 animate-spin text-slate-500" />
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-slate-200">Enable SLA alerts</Label>
              <p className="text-xs text-slate-500">Turn first-response escalations on or off.</p>
            </div>
            <Switch checked={enabled} onCheckedChange={setEnabled} disabled={!canManage} />
          </div>

          <div className="flex items-center justify-between gap-4">
            <div>
              <Label className="text-slate-200">Response time target</Label>
              <p className="text-xs text-slate-500">Minutes before a lead is flagged as breached.</p>
            </div>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                step={1}
                value={minutes}
                disabled={!canManage || !enabled}
                onChange={(e) => setMinutes(e.target.value)}
                className="h-9 w-24 bg-slate-800 border-slate-700 text-white text-right disabled:opacity-60"
              />
              <span className="text-sm text-slate-400">min</span>
            </div>
          </div>

          {canManage ? (
            <div className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {saving && <Loader2 className="size-4 animate-spin" />}
                Save
              </Button>
            </div>
          ) : (
            <p className="text-xs text-slate-500">Only admins and owners can change SLA settings.</p>
          )}
        </div>
      )}
    </div>
  )
}
