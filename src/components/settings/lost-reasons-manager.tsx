'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canManageLostReasons } from '@/lib/auth/permissions'
import type { LostReason } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Plus, Trash2, Pencil, Loader2, Lock } from 'lucide-react'
import { toast } from 'sonner'

export function LostReasonsManager() {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageLostReasons(profile?.role ?? null)

  const [reasons, setReasons] = useState<LostReason[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [reasonText, setReasonText] = useState('')
  const [saving, setSaving] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchReasons = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('lost_reasons')
      .select('*')
      .order('sort_order')
      .order('reason')
    if (error) {
      toast.error('Failed to load lost reasons')
    } else {
      setReasons((data ?? []) as LostReason[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReasons()
  }, [fetchReasons])

  function openCreate() {
    setEditingId(null)
    setReasonText('')
    setDialogOpen(true)
  }

  function openEdit(r: LostReason) {
    setEditingId(r.id)
    setReasonText(r.reason)
    setDialogOpen(true)
  }

  async function handleSave() {
    const text = reasonText.trim()
    if (!text) {
      toast.error('Reason text is required')
      return
    }

    setSaving(true)
    if (editingId) {
      const { error } = await supabase
        .from('lost_reasons')
        .update({ reason: text })
        .eq('id', editingId)
      setSaving(false)
      if (error) {
        toast.error(error.message)
        return
      }
      toast.success('Lost reason updated')
    } else {
      // Auto-increment sort_order: max + 1
      const maxOrder = reasons.reduce((m, r) => Math.max(m, r.sort_order), 0)
      const { error } = await supabase.from('lost_reasons').insert({
        reason: text,
        sort_order: maxOrder + 1,
      })
      setSaving(false)
      if (error) {
        toast.error(
          error.message.includes('duplicate')
            ? 'That reason already exists'
            : 'Failed to create lost reason',
        )
        return
      }
      toast.success('Lost reason added')
    }

    setDialogOpen(false)
    fetchReasons()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase
      .from('lost_reasons')
      .delete()
      .eq('id', deleteId)
    setDeleting(false)
    if (error) {
      // DB trigger surfaces here for system rows
      toast.error(error.message)
      return
    }
    toast.success('Lost reason deleted')
    setDeleteId(null)
    fetchReasons()
  }

  const reasonToDelete = reasons.find((r) => r.id === deleteId)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Lost Reasons</h2>
          <p className="text-xs text-slate-500">
            When marking a deal as lost, agents must select one of these reasons.{' '}
            <span className="text-slate-400">System reasons</span> cannot be deleted.
          </p>
        </div>
        {canManage && (
          <Button
            onClick={openCreate}
            className="bg-primary text-primary-foreground hover:bg-primary/90"
          >
            <Plus className="size-4" /> Add Reason
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : reasons.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No lost reasons yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {reasons.map((r) => (
              <li key={r.id} className="flex items-center gap-3 px-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">{r.reason}</span>
                    {r.is_system && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        <Lock className="size-2.5" /> System
                      </span>
                    )}
                  </div>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(r)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => !r.is_system && setDeleteId(r.id)}
                      disabled={r.is_system}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                      title={r.is_system ? 'System reasons cannot be deleted' : 'Delete'}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {!canManage && (
        <p className="text-xs text-slate-500">
          Only admins can add, edit, or delete lost reasons.
        </p>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? 'Edit Lost Reason' : 'Add Lost Reason'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Agents select this when marking a deal as lost.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <Label className="text-slate-300">Reason</Label>
            <Input
              value={reasonText}
              onChange={(e) => setReasonText(e.target.value)}
              placeholder="e.g. Budget Constraints"
              className="bg-slate-800 border-slate-700 text-white"
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSave()
              }}
            />
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !reasonText.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Save' : 'Add'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm dialog */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Lost Reason?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Delete &ldquo;{reasonToDelete?.reason}&rdquo;? Deals that used this reason will
              retain their existing value, but it will no longer appear in the selector.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
