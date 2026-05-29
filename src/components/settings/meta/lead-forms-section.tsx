'use client'

import { useState, useEffect, useCallback } from 'react'
import { Loader2, RefreshCw, Settings2, FileText } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { FieldMappingDialog } from './field-mapping-dialog'
import type { FacebookLeadForm } from '@/lib/meta/types'

interface Props {
  pageId: string
}

interface FormWithMappings extends FacebookLeadForm {
  facebook_field_mappings?: [{ count: number }]
}

export function LeadFormsSection({ pageId }: Props) {
  const [forms, setForms] = useState<FormWithMappings[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [mappingForm, setMappingForm] = useState<FormWithMappings | null>(null)

  const loadForms = useCallback(
    async (showSpinner = false) => {
      if (showSpinner) setRefreshing(true)
      try {
        const res = await fetch(`/api/meta/pages/${pageId}/forms`)
        if (!res.ok) throw new Error('Failed to fetch forms')
        const data = (await res.json()) as { forms: FormWithMappings[] }
        setForms(data.forms ?? [])
      } catch {
        toast.error('Failed to load lead forms')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [pageId],
  )

  useEffect(() => {
    loadForms()
  }, [loadForms])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-4 pl-2 text-sm text-slate-500">
        <Loader2 className="size-4 animate-spin" />
        Loading forms…
      </div>
    )
  }

  if (forms.length === 0) {
    return (
      <div className="flex items-center justify-between py-3 pl-2">
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
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
          Lead Forms
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
