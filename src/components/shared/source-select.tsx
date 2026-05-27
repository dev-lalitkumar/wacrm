'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Source } from '@/types'

interface SourceSelectProps {
  value: string | null | undefined
  onChange: (id: string) => void
  /** Optional extra className appended to the `<select>`. */
  className?: string
  disabled?: boolean
}

/**
 * Dropdown for picking a Source on contact/deal create + edit forms.
 *
 * Behaviour:
 *   - Fetches `sources` ordered by sort_order on mount.
 *   - When `value` is null/undefined, auto-selects the row with key='direct'
 *     and fires `onChange(directId)` so the parent's state matches what the
 *     user sees. This keeps Direct as the default everywhere without each
 *     caller needing to manage that state.
 *   - Selecting "Direct" or any other source is plain string id passthrough.
 */
export function SourceSelect({
  value,
  onChange,
  className,
  disabled,
}: SourceSelectProps) {
  const supabase = createClient()
  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const { data } = await supabase
        .from('sources')
        .select('id, name, key, is_system, sort_order, created_at')
        .order('sort_order')
        .order('name')
      if (cancelled) return
      const list = (data ?? []) as Source[]
      setSources(list)
      setLoading(false)

      // Auto-select Direct when nothing was passed in.
      if (!value && list.length > 0) {
        const direct = list.find((s) => s.key === 'direct') ?? list[0]
        onChange(direct.id)
      }
    })()
    return () => {
      cancelled = true
    }
    // We deliberately only re-run when the supabase client identity changes;
    // re-firing on value changes would loop the default-select branch above.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [supabase])

  return (
    <select
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value)}
      disabled={disabled || loading}
      className={
        'h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50 ' +
        (className ?? '')
      }
    >
      {loading ? (
        <option value="">Loading sources…</option>
      ) : sources.length === 0 ? (
        <option value="">No sources defined</option>
      ) : (
        sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name}
          </option>
        ))
      )}
    </select>
  )
}
