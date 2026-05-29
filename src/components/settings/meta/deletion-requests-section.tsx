'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, CheckCircle2, Clock, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

interface DeletionRequest {
  id: string
  confirmation_code: string
  fb_user_id: string
  status: 'pending' | 'in_progress' | 'completed'
  notes: string | null
  created_at: string
  processed_at: string | null
}

const STATUS_CONFIG = {
  pending: { icon: Clock, cls: 'text-amber-400', label: 'Pending' },
  in_progress: { icon: Loader2, cls: 'text-blue-400', label: 'In Progress' },
  completed: { icon: CheckCircle2, cls: 'text-green-400', label: 'Completed' },
}

function timeAgoShort(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / 86400000)
  if (days === 0) return 'today'
  if (days === 1) return 'yesterday'
  return `${days}d ago`
}

export function DeletionRequestsSection() {
  const [requests, setRequests] = useState<DeletionRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [updating, setUpdating] = useState<string | null>(null)

  const loadRequests = useCallback(async () => {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from('meta_data_deletion_requests')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)

      if (error) throw error
      setRequests((data ?? []) as DeletionRequest[])
    } catch {
      toast.error('Failed to load deletion requests')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadRequests() }, [loadRequests])

  async function markStatus(id: string, status: DeletionRequest['status']) {
    setUpdating(id)
    try {
      const supabase = createClient()
      const patch: Record<string, unknown> = {
        status,
        updated_at: new Date().toISOString(),
      }
      if (status === 'completed') patch.processed_at = new Date().toISOString()

      const { error } = await supabase
        .from('meta_data_deletion_requests')
        .update(patch)
        .eq('id', id)

      if (error) throw error
      toast.success(`Request marked as ${status}`)
      await loadRequests()
    } catch {
      toast.error('Failed to update request')
    } finally {
      setUpdating(null)
    }
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div>
            <CardTitle className="text-white">Data Deletion Requests</CardTitle>
            <CardDescription>
              Facebook user data deletion requests. Review and process each request within 30 days.
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={loadRequests}
            className="shrink-0 text-slate-400 hover:text-slate-200"
          >
            <RefreshCw className="size-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : requests.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No deletion requests received yet.
          </div>
        ) : (
          <div className="space-y-3">
            {requests.map((req) => {
              const s = STATUS_CONFIG[req.status]
              const Icon = s.icon
              const isPending = req.status !== 'completed'
              return (
                <div
                  key={req.id}
                  className="rounded-lg border border-slate-800 bg-slate-800/30 p-4"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <Icon className={`size-4 shrink-0 ${s.cls}`} />
                        <span className={`text-sm font-medium ${s.cls}`}>{s.label}</span>
                        <span className="text-xs text-slate-500">
                          · received {timeAgoShort(req.created_at)}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400">
                        FB User ID:{' '}
                        <code className="rounded bg-slate-800 px-1 text-slate-200">
                          {req.fb_user_id}
                        </code>
                      </div>
                      <div className="text-xs text-slate-400">
                        Code:{' '}
                        <code className="rounded bg-slate-800 px-1 text-slate-200">
                          {req.confirmation_code}
                        </code>
                      </div>
                      {req.processed_at && (
                        <div className="text-xs text-green-400">
                          Completed {timeAgoShort(req.processed_at)}
                        </div>
                      )}
                    </div>

                    {isPending && (
                      <div className="flex shrink-0 gap-2">
                        {req.status === 'pending' && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => markStatus(req.id, 'in_progress')}
                            disabled={updating === req.id}
                            className="h-7 border-slate-700 text-xs text-slate-300 hover:bg-slate-800"
                          >
                            {updating === req.id ? (
                              <Loader2 className="size-3 animate-spin" />
                            ) : (
                              <AlertCircle className="size-3" />
                            )}
                            In Progress
                          </Button>
                        )}
                        <Button
                          size="sm"
                          onClick={() => markStatus(req.id, 'completed')}
                          disabled={updating === req.id}
                          className="h-7 bg-green-600 text-xs text-white hover:bg-green-700"
                        >
                          {updating === req.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : (
                            <CheckCircle2 className="size-3" />
                          )}
                          Mark Complete
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        <p className="mt-4 text-xs text-slate-500">
          To delete a user&apos;s data: search for their Facebook User ID in Contacts, delete the
          contact record, then mark this request as completed.
        </p>
      </CardContent>
    </Card>
  )
}
