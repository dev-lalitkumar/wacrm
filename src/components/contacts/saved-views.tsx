'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { Bookmark, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

interface SavedView {
  id: string
  name: string
  filters: Record<string, unknown>
}

interface SavedViewsProps {
  scope: string
  /** The current filter set to persist when saving. */
  currentFilters: Record<string, unknown>
  /** Apply a saved view's filters to the page. */
  onApply: (filters: Record<string, unknown>) => void
}

export function SavedViews({ scope, currentFilters, onApply }: SavedViewsProps) {
  const supabase = createClient()
  const { profile } = useAuth()
  const [views, setViews] = useState<SavedView[]>([])

  const fetchViews = useCallback(async () => {
    const { data } = await supabase
      .from('saved_views')
      .select('id, name, filters')
      .eq('scope', scope)
      .order('created_at', { ascending: true })
    setViews((data ?? []) as SavedView[])
  }, [supabase, scope])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchViews()
  }, [fetchViews])

  async function saveCurrent() {
    if (!profile?.id) return
    const name = window.prompt('Name this view (e.g. "My hot leads")')?.trim()
    if (!name) return
    const { error } = await supabase.from('saved_views').insert({
      profile_id: profile.id,
      scope,
      name,
      filters: currentFilters,
    })
    if (error) { toast.error('Failed to save view'); return }
    toast.success('View saved')
    fetchViews()
  }

  async function remove(id: string) {
    const { error } = await supabase.from('saved_views').delete().eq('id', id)
    if (error) { toast.error('Failed to delete view'); return }
    fetchViews()
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-3 text-xs font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-200 cursor-pointer">
        <Bookmark className="size-3.5" /> Views
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="bg-slate-900 border-slate-700 text-slate-200 min-w-52 max-h-72 overflow-y-auto">
        <DropdownMenuItem onClick={saveCurrent} className="cursor-pointer text-primary">
          <Plus className="size-3.5" /> Save current view
        </DropdownMenuItem>
        {views.length > 0 && <DropdownMenuSeparator className="bg-slate-700" />}
        {views.map((v) => (
          <div key={v.id} className="flex items-center">
            <DropdownMenuItem
              onClick={() => onApply(v.filters)}
              className="flex-1 cursor-pointer"
            >
              {v.name}
            </DropdownMenuItem>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(v.id) }}
              className="mr-1 rounded p-1 text-slate-500 hover:bg-slate-800 hover:text-red-400 cursor-pointer"
              title="Delete view"
            >
              <Trash2 className="size-3.5" />
            </button>
          </div>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
