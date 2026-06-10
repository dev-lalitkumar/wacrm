'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Settings2, FileText, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { FieldMappingDialog } from './field-mapping-dialog'
import type { FacebookLeadForm } from '@/lib/meta/types'

interface Props {
  pageId: string
  /** Bump to force a reload (e.g. right after page subscribe). */
  reloadKey?: number
}

interface FormWithMappings extends FacebookLeadForm {
  facebook_field_mappings?: [{ count: number }]
}

interface FormsApiResponse {
  forms?: FormWithMappings[]
  synced_count?: number
  warning?: string
  graph_error?: string
  upsert_error?: string
  error?: string
}

export function LeadFormsSection({ pageId, reloadKey = 0 }: Props) {
  const [forms, setForms] = useState<FormWithMappings[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mappingForm, setMappingForm] = useState<FormWithMappings | null>(null)
  const [syncedCount, setSyncedCount] = useState<number | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [graphError, setGraphError] = useState<string | null>(null)
  const [upsertError, setUpsertError] = useState<string | null>(null)

  const loadForms = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true)
      try {
        const res = await fetch(`/api/meta/pages/${pageId}/forms`, { cache: 'no-store' })
        const data = (await res.json()) as FormsApiResponse
        if (!res.ok) {
          throw new Error(data.error ?? 'Failed to fetch forms')
        }
        setForms(data.forms ?? [])
        setSyncedCount(data.synced_count ?? null)
        setWarning(data.warning ?? null)
        setGraphError(data.graph_error ?? null)
        setUpsertError(data.upsert_error ?? null)
        if (data.upsert_error) {
          toast.error('Forms fetched but failed to save', { description: data.upsert_error })
        }
      } catch (err) {
        toast.error('Failed to load lead forms', {
          description: err instanceof Error ? err.message : undefined,
        })
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [pageId],
  )

  useEffect(() => {
    loadForms()
  }, [loadForms, reloadKey])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 pl-2 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Loading forms…
      </div>
    )
  }

  const statusAlerts = (
    <>
      {graphError && (
        <Alert className="border-red-500/30 bg-red-500/5">
          <AlertTriangle className="size-4 text-red-400" />
          <AlertDescription className="text-sm text-red-300">
            Meta API error: {graphError}
          </AlertDescription>
        </Alert>
      )}
      {upsertError && (
        <Alert className="border-red-500/30 bg-red-500/5">
          <AlertTriangle className="size-4 text-red-400" />
          <AlertDescription className="text-sm text-red-300">
            Database save failed: {upsertError}
          </AlertDescription>
        </Alert>
      )}
      {warning && (
        <Alert className="border-amber-500/30 bg-amber-500/5">
          <AlertTriangle className="size-4 text-amber-400" />
          <AlertDescription className="text-sm text-amber-200">{warning}</AlertDescription>
        </Alert>
      )}
    </>
  )

  if (forms.length === 0) {
    return (
      <div className="space-y-3 py-3 pl-2">
        {statusAlerts}
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-500">No lead forms found for this page.</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => loadForms(true)}
            disabled={refreshing}
            className="text-slate-400 hover:text-slate-200"
          >
            {refreshing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
            Refresh
          </Button>
        </div>
        <p className="text-xs text-slate-500">
          If you have active Instant Forms in Ads Manager, check Leads Access Manager in Meta
          Business Settings and ensure your connected Facebook user has leads access on this Page.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Lead Forms
          {syncedCount != null && syncedCount > 0 && (
            <span className="ml-2 font-normal normal-case text-slate-400">
              ({syncedCount} synced from Meta)
            </span>
          )}
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => loadForms(true)}
          disabled={refreshing}
          className="h-7 text-xs text-slate-400 hover:text-slate-200"
        >
          {refreshing ? <Loader2 className="size-3 animate-spin" /> : <RefreshCw className="size-3" />}
          Refresh forms
        </Button>
      </div>

      {statusAlerts}

      {forms.map((form) => {
        const mappingCount = form.facebook_field_mappings?.[0]?.count ?? 0
        return (
          <div
            key={form.id}
            className="flex items-center justify-between rounded-md border border-slate-800 bg-slate-800/30 px-3 py-2.5"
          >
            <div className="flex items-center gap-2 min-w-0">
              <FileText className="size-4 shrink-0 text-slate-500" />
              <span className="truncate text-sm text-slate-200">{form.name}</span>
              {mappingCount > 0 ? (
                <Badge variant="secondary" className="text-xs">
                  {mappingCount} mapped
                </Badge>
              ) : (
                <Badge variant="outline" className="border-amber-600/40 text-xs text-amber-500">
                  not mapped
                </Badge>
              )}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setMappingForm(form)}
              className="ml-2 h-7 shrink-0 text-xs text-slate-400 hover:text-slate-200"
            >
              <Settings2 className="size-3" />
              Map Fields
            </Button>
          </div>
        )
      })}

      {mappingForm && (
        <FieldMappingDialog
          open={!!mappingForm}
          onOpenChange={(open) => {
            if (!open) {
              setMappingForm(null)
              loadForms()
            }
          }}
          formId={mappingForm.id}
          formName={mappingForm.name}
          questions={mappingForm.questions}
        />
      )}
    </div>
  )
}
