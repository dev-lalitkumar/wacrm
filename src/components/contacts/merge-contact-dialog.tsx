'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Loader2, Search, GitMerge, AlertTriangle } from 'lucide-react'
import { toast } from 'sonner'

interface SurvivorContact {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}

interface MergeContactDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The contact that is kept (records merge INTO this one). */
  survivor: SurvivorContact
  onMerged: () => void
}

interface Candidate {
  id: string
  name: string | null
  phone: string | null
  email: string | null
}

export function MergeContactDialog({ open, onOpenChange, survivor, onMerged }: MergeContactDialogProps) {
  const supabase = createClient()
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<Candidate[]>([])
  const [searching, setSearching] = useState(false)
  const [loser, setLoser] = useState<Candidate | null>(null)
  const [merging, setMerging] = useState(false)

  const runSearch = useCallback(async (term: string) => {
    if (term.trim().length < 2) { setResults([]); return }
    setSearching(true)
    const like = `%${term.trim()}%`
    const { data } = await supabase
      .from('contacts')
      .select('id, name, phone, email')
      .or(`name.ilike.${like},phone.ilike.${like},email.ilike.${like}`)
      .neq('id', survivor.id)
      .limit(8)
    setResults((data ?? []) as Candidate[])
    setSearching(false)
  }, [supabase, survivor.id])

  // Debounced search
  useEffect(() => {
    if (!open) return
    const t = setTimeout(() => runSearch(search), 250)
    return () => clearTimeout(t)
  }, [search, open, runSearch])

  // Reset when closed
  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearch(''); setResults([]); setLoser(null)
    }
  }, [open])

  async function handleMerge() {
    if (!loser) return
    setMerging(true)
    const res = await fetch('/api/contacts/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ survivorId: survivor.id, loserId: loser.id }),
    })
    setMerging(false)
    if (!res.ok) {
      const { error } = await res.json().catch(() => ({ error: '' }))
      toast.error(error || 'Merge failed')
      return
    }
    toast.success('Contacts merged')
    onMerged()
    onOpenChange(false)
  }

  const survivorLabel = survivor.name || survivor.phone || survivor.email || 'this contact'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white flex items-center gap-2">
            <GitMerge className="size-4 text-primary" /> Merge Duplicate
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            Records from the duplicate you pick will move into{' '}
            <span className="text-slate-200 font-medium">{survivorLabel}</span>, then the
            duplicate is deleted. This can&rsquo;t be undone.
          </DialogDescription>
        </DialogHeader>

        {!loser ? (
          <div className="space-y-2 py-1">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-slate-500" />
              <Input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search the duplicate by name, phone, or email…"
                className="pl-8 bg-slate-800 border-slate-700 text-white"
              />
            </div>
            <div className="max-h-60 overflow-y-auto rounded-lg border border-slate-700/60 divide-y divide-slate-700/50">
              {searching ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="size-4 animate-spin text-slate-500" />
                </div>
              ) : results.length === 0 ? (
                <p className="py-6 text-center text-xs text-slate-500">
                  {search.trim().length < 2 ? 'Type at least 2 characters.' : 'No matching contacts.'}
                </p>
              ) : (
                results.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setLoser(c)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left hover:bg-slate-800 cursor-pointer"
                  >
                    <span className="text-sm text-slate-200">{c.name || '(no name)'}</span>
                    <span className="text-xs text-slate-500">{c.phone || c.email || '—'}</span>
                  </button>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-3 py-1">
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 flex gap-2">
              <AlertTriangle className="size-4 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-200/90 space-y-1">
                <p>
                  Merge <span className="font-medium">{loser.name || loser.phone || loser.email}</span>{' '}
                  into <span className="font-medium">{survivorLabel}</span>?
                </p>
                <p className="text-amber-200/70">
                  All deals, conversations, follow-ups, emails, calls, tags and notes move to the
                  kept contact. The duplicate is then deleted.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setLoser(null)}
              className="text-xs text-primary hover:underline cursor-pointer"
            >
              ← Pick a different contact
            </button>
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
            onClick={handleMerge}
            disabled={!loser || merging}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            {merging && <Loader2 className="size-4 animate-spin" />}
            Merge
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
