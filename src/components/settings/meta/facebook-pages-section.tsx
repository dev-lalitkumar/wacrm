'use client'

import { useState, useCallback } from 'react'
import { ChevronDown, ChevronRight, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { LeadFormsSection } from './lead-forms-section'
import type { FacebookPage } from '@/lib/meta/types'

interface Props {
  pages: FacebookPage[]
  onPagesChange: (pages: FacebookPage[]) => void
}

interface SubscribeResponse {
  success?: boolean
  forms_synced?: number
  warning?: string
  graph_error?: string
  upsert_error?: string
  error?: string
}

export function FacebookPagesSection({ pages, onPagesChange }: Props) {
  const [toggling, setToggling] = useState<Record<string, boolean>>({})
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [formsReloadKey, setFormsReloadKey] = useState<Record<string, number>>({})

  const toggleSubscription = useCallback(
    async (page: FacebookPage) => {
      setToggling((prev) => ({ ...prev, [page.id]: true }))
      const wasSubscribed = page.is_subscribed
      try {
        const res = await fetch(`/api/meta/pages/${page.id}/subscribe`, {
          method: wasSubscribed ? 'DELETE' : 'POST',
        })
        const data = (await res.json()) as SubscribeResponse
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed')
        }
        onPagesChange(
          pages.map((p) =>
            p.id === page.id
              ? {
                  ...p,
                  is_subscribed: !wasSubscribed,
                  subscribed_at: !wasSubscribed ? new Date().toISOString() : null,
                }
              : p,
          ),
        )
        if (wasSubscribed) {
          toast.success(`Unsubscribed ${page.name} from lead webhooks`)
          setExpanded((prev) => ({ ...prev, [page.id]: false }))
        } else {
          setExpanded((prev) => ({ ...prev, [page.id]: true }))
          setFormsReloadKey((prev) => ({
            ...prev,
            [page.id]: (prev[page.id] ?? 0) + 1,
          }))
          const synced = data.forms_synced ?? 0
          toast.success(`Subscribed ${page.name} to lead webhooks`, {
            description:
              synced > 0
                ? `${synced} lead form${synced !== 1 ? 's' : ''} synced — map phone or email below`
                : data.warning ?? 'No forms synced yet — expand to refresh or check Meta permissions',
          })
          if (data.graph_error) {
            toast.warning('Meta API returned an error while syncing forms', {
              description: data.graph_error,
            })
          }
          if (data.upsert_error) {
            toast.error('Failed to save forms to database', {
              description: data.upsert_error,
            })
          }
        }
      } catch (err) {
        toast.error(`Failed to ${wasSubscribed ? 'unsubscribe' : 'subscribe'}: ${err}`)
      } finally {
        setToggling((prev) => ({ ...prev, [page.id]: false }))
      }
    },
    [pages, onPagesChange],
  )

  if (pages.length === 0) {
    return (
      <Card className="border-slate-800 bg-slate-900">
        <CardContent className="py-8 text-center text-sm text-slate-500">
          No Facebook Pages found. Make sure your account has admin access to at least one page.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardHeader>
        <CardTitle className="text-white">Facebook Pages</CardTitle>
        <CardDescription>
          Subscribe pages to receive lead events. Expand a page to configure form field mappings.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {pages.map((page) => {
          const isExpanded = !!expanded[page.id]
          return (
            <div
              key={page.id}
              className="rounded-lg border border-slate-800 bg-slate-800/30 overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {page.picture_url ? (
                  <img
                    src={page.picture_url}
                    alt={page.name}
                    className="size-9 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <div className="size-9 rounded-full bg-slate-700 shrink-0 flex items-center justify-center text-slate-400 text-xs font-bold">
                    {page.name.slice(0, 2).toUpperCase()}
                  </div>
                )}

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-200 truncate">{page.name}</span>
                    {page.is_subscribed && (
                      <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs shrink-0">
                        Subscribed
                      </Badge>
                    )}
                  </div>
                  {page.category && (
                    <p className="text-xs text-slate-500 mt-0.5">{page.category}</p>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {toggling[page.id] ? (
                    <Loader2 className="size-4 animate-spin text-slate-500" />
                  ) : (
                    <Switch
                      checked={page.is_subscribed}
                      onCheckedChange={() => toggleSubscription(page)}
                    />
                  )}

                  {page.is_subscribed && (
                    <button
                      onClick={() => setExpanded((prev) => ({ ...prev, [page.id]: !isExpanded }))}
                      className="ml-1 text-slate-400 hover:text-slate-200 transition-colors"
                      aria-label={isExpanded ? 'Collapse forms' : 'Expand forms'}
                    >
                      {isExpanded ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </button>
                  )}
                </div>
              </div>

              {isExpanded && page.is_subscribed && (
                <div className="border-t border-slate-800 px-4 py-3 bg-slate-900/50">
                  <LeadFormsSection
                    pageId={page.id}
                    reloadKey={formsReloadKey[page.id] ?? 0}
                  />
                </div>
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
