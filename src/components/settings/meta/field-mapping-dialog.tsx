'use client'

import { useState, useEffect } from 'react'
import { Loader2, Save } from 'lucide-react'
import { toast } from 'sonner'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import type { FacebookLeadFormQuestion, FieldMapping } from '@/lib/meta/types'

interface NormalizedQuestion {
  key: string
  label: string
  type: string
}

function normalizeQuestion(q: FacebookLeadFormQuestion): NormalizedQuestion | null {
  if (!q.key) return null
  return { key: q.key, label: q.label ?? q.key, type: q.type ?? 'TEXT' }
}

interface CrmFieldOption {
  value: string
  label: string
  group: string
}

const STANDARD_CONTACT_FIELDS: CrmFieldOption[] = [
  { value: 'contact|name', label: 'Name', group: 'Contact' },
  { value: 'contact|email', label: 'Email', group: 'Contact' },
  { value: 'contact|phone', label: 'Phone', group: 'Contact' },
  { value: 'contact|company', label: 'Company', group: 'Contact' },
]

const STANDARD_DEAL_FIELDS: CrmFieldOption[] = [
  { value: 'deal|title', label: 'Deal Title', group: 'Deal' },
  { value: 'deal|notes', label: 'Deal Notes', group: 'Deal' },
  { value: 'deal|value', label: 'Deal Value', group: 'Deal' },
]

interface Props {
  open: boolean
  onOpenChange: (open: boolean) => void
  formId: string
  formName: string
  questions: FacebookLeadFormQuestion[]
}

export function FieldMappingDialog({
  open,
  onOpenChange,
  formId,
  formName,
  questions,
}: Props) {
  const normalizedQuestions: NormalizedQuestion[] = questions
    .map(normalizeQuestion)
    .filter((q): q is NormalizedQuestion => q !== null)

  const [mappings, setMappings] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open || !formId) return
    setLoading(true)
    fetch(`/api/meta/field-mappings?form_id=${formId}`)
      .then((r) => r.json())
      .then((data: { mappings?: FieldMapping[] }) => {
        const map: Record<string, string> = {}
        for (const m of data.mappings ?? []) {
          map[m.fb_field_key] = `${m.crm_object}|${m.crm_field}`
        }
        setMappings(map)
      })
      .catch(() => toast.error('Failed to load existing mappings'))
      .finally(() => setLoading(false))
  }, [open, formId])

  function setMapping(fbKey: string, crmValue: string) {
    if (!fbKey) return
    setMappings((prev) => {
      if (crmValue === '__ignore__') {
        const next = { ...prev }
        delete next[fbKey]
        return next
      }
      return { ...prev, [fbKey]: crmValue }
    })
  }

  async function handleSave() {
    const hasPhoneOrEmail = Object.values(mappings).some(
      (v) => v === 'contact|phone' || v === 'contact|email',
    )
    if (!hasPhoneOrEmail) {
      toast.error('Map at least phone or email', {
        description:
          'Facebook leads need a phone or email mapping to create contacts and deals in the CRM.',
      })
      return
    }

    setSaving(true)
    try {
      const rows = Object.entries(mappings).map(([fbKey, crmValue]) => {
        const [crm_object, crm_field] = crmValue.split('|') as ['contact' | 'deal', string]
        return { fb_field_key: fbKey, crm_object, crm_field }
      })

      const res = await fetch('/api/meta/field-mappings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ form_id: formId, mappings: rows }),
      })
      if (!res.ok) throw new Error('Save failed')
      toast.success('Field mappings saved')
      onOpenChange(false)
    } catch {
      toast.error('Failed to save mappings')
    } finally {
      setSaving(false)
    }
  }

  const allOptions = [...STANDARD_CONTACT_FIELDS, ...STANDARD_DEAL_FIELDS]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-slate-800 bg-slate-900 text-white">
        <DialogHeader>
          <DialogTitle>Map Fields — {formName}</DialogTitle>
          <DialogDescription className="text-slate-400">
            Map each Facebook form field to a CRM contact or deal field. Unmapped fields are ignored.
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="size-6 animate-spin text-slate-500" />
          </div>
        ) : normalizedQuestions.length === 0 ? (
          <p className="py-4 text-center text-sm text-slate-500">
            No questions found in this form. Refresh forms to sync.
          </p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-slate-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-800 bg-slate-800/50">
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Facebook Field</th>
                  <th className="px-4 py-2.5 text-left font-medium text-slate-400">Map to CRM Field</th>
                </tr>
              </thead>
              <tbody>
                {normalizedQuestions.map((q, idx) => (
                  <tr
                    key={q.key ?? idx}
                    className={idx % 2 === 0 ? 'bg-slate-900' : 'bg-slate-800/20'}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-slate-200">{q.label}</div>
                      <div className="text-xs text-slate-500">{q.key} · {q.type}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Select
                        value={mappings[q.key] ?? '__ignore__'}
                        onValueChange={(v) => v != null && setMapping(q.key, v)}
                      >
                        <SelectTrigger className="h-8 w-full border-slate-700 bg-slate-800 text-slate-200 text-sm">
                          <SelectValue placeholder="— Ignore —" />
                        </SelectTrigger>
                        <SelectContent className="border-slate-700 bg-slate-900">
                          <SelectItem value="__ignore__" className="text-slate-400">
                            — Ignore —
                          </SelectItem>
                          {['Contact', 'Deal'].map((group) => (
                            <div key={group}>
                              <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wider text-slate-500">
                                {group}
                              </div>
                              {allOptions
                                .filter((o) => o.group === group)
                                .map((opt) => (
                                  <SelectItem key={opt.value} value={opt.value} className="text-slate-200">
                                    {opt.label}
                                  </SelectItem>
                                ))}
                            </div>
                          ))}
                        </SelectContent>
                      </Select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || loading}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
            Save Mappings
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
