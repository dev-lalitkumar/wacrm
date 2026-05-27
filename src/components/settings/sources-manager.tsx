'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import { canManageSources } from '@/lib/auth/permissions'
import type { Source } from '@/types'
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
import {
  Plus,
  Trash2,
  Pencil,
  Loader2,
  Lock,
  Tag as TagIcon,
} from 'lucide-react'
import { toast } from 'sonner'

/**
 * Auto-derive a URL-safe machine key from a display name. Used as a
 * suggested value in the create form; the admin can still overwrite.
 * Mirrors the typical "slugify" behaviour: lowercase, non-alphanumerics
 * replaced with single dashes, leading/trailing dashes stripped.
 */
function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

interface FormState {
  name: string
  key: string
  sort_order: string
}

const BLANK: FormState = { name: '', key: '', sort_order: '0' }

export function SourcesManager() {
  const supabase = createClient()
  const { profile } = useAuth()
  const canManage = canManageSources(profile?.role ?? null)

  const [sources, setSources] = useState<Source[]>([])
  const [loading, setLoading] = useState(true)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<FormState>(BLANK)
  const [saving, setSaving] = useState(false)

  // Manual key edit tracking — once the admin types in the key field,
  // stop auto-slugifying from the name. Prevents wiping a deliberate key
  // when the admin tweaks the display name afterwards.
  const [keyTouched, setKeyTouched] = useState(false)

  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const fetchSources = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('sources')
      .select('*')
      .order('sort_order')
      .order('name')
    if (error) {
      toast.error('Failed to load sources')
    } else {
      setSources((data ?? []) as Source[])
    }
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchSources()
  }, [fetchSources])

  function openCreate() {
    setEditingId(null)
    setForm(BLANK)
    setKeyTouched(false)
    setDialogOpen(true)
  }

  function openEdit(source: Source) {
    setEditingId(source.id)
    setForm({
      name: source.name,
      key: source.key,
      sort_order: String(source.sort_order),
    })
    setKeyTouched(true) // editing existing — never auto-derive
    setDialogOpen(true)
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast.error('Name is required')
      return
    }
    const key = form.key.trim() || slugify(form.name)
    if (!key) {
      toast.error('Key cannot be empty')
      return
    }

    setSaving(true)
    const payload = {
      name: form.name.trim(),
      key,
      sort_order: parseInt(form.sort_order, 10) || 0,
    }

    if (editingId) {
      const { error } = await supabase
        .from('sources')
        .update(payload)
        .eq('id', editingId)
      setSaving(false)
      if (error) {
        // Trigger throws on system-row immutable-field updates
        toast.error(error.message)
        return
      }
      toast.success('Source updated')
    } else {
      const { error } = await supabase.from('sources').insert(payload)
      setSaving(false)
      if (error) {
        toast.error(error.message.includes('duplicate') ? 'Name or key already exists' : 'Failed to create source')
        return
      }
      toast.success('Source created')
    }

    setDialogOpen(false)
    fetchSources()
  }

  async function handleDelete() {
    if (!deleteId) return
    setDeleting(true)
    const { error } = await supabase.from('sources').delete().eq('id', deleteId)
    setDeleting(false)
    if (error) {
      // DB trigger surfaces here for system rows
      toast.error(error.message)
      return
    }
    toast.success('Source deleted')
    setDeleteId(null)
    fetchSources()
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-white">Sources</h2>
          <p className="text-xs text-slate-500">
            Tag every contact and deal with where it came from. <span className="text-slate-400">Direct</span> and <span className="text-slate-400">WhatsApp</span> are system sources and cannot be deleted.
          </p>
        </div>
        {canManage && (
          <Button onClick={openCreate} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="size-4" /> Add Source
          </Button>
        )}
      </div>

      <div className="rounded-lg border border-slate-700 bg-slate-800/40">
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="size-5 animate-spin text-slate-500" />
          </div>
        ) : sources.length === 0 ? (
          <div className="py-10 text-center text-sm text-slate-500">
            No sources yet.
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/50">
            {sources.map((s) => (
              <li
                key={s.id}
                className="flex items-center gap-3 px-3 py-2.5"
              >
                <TagIcon className="size-3.5 shrink-0 text-slate-500" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-slate-200">
                      {s.name}
                    </span>
                    {s.is_system && (
                      <span className="inline-flex items-center gap-0.5 rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                        <Lock className="size-2.5" /> System
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-slate-500 font-mono">{s.key}</p>
                </div>
                {canManage && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => openEdit(s)}
                      className="rounded p-1.5 text-slate-400 hover:bg-slate-700 hover:text-white cursor-pointer"
                      title="Edit"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => !s.is_system && setDeleteId(s.id)}
                      disabled={s.is_system}
                      className="rounded p-1.5 text-slate-400 hover:bg-red-500/15 hover:text-red-400 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-slate-400 disabled:cursor-not-allowed cursor-pointer"
                      title={s.is_system ? 'System sources cannot be deleted' : 'Delete'}
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
          Only admins can add, edit, or delete sources.
        </p>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingId ? 'Edit Source' : 'Add Source'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              Sources are visible to every team member and selectable on every contact and deal.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label className="text-slate-300">Name</Label>
              <Input
                value={form.name}
                onChange={(e) => {
                  const v = e.target.value
                  setForm((f) => ({
                    ...f,
                    name: v,
                    key: keyTouched ? f.key : slugify(v),
                  }))
                }}
                placeholder="e.g. Facebook Lead Form"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Key</Label>
              <Input
                value={form.key}
                onChange={(e) => {
                  setKeyTouched(true)
                  setForm((f) => ({ ...f, key: e.target.value }))
                }}
                placeholder="auto-generated from name"
                className="bg-slate-800 border-slate-700 text-white font-mono text-sm"
              />
              <p className="text-xs text-slate-500">
                Machine-readable identifier. Lowercase, dashes only.
              </p>
            </div>

            <div className="space-y-2">
              <Label className="text-slate-300">Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) => setForm((f) => ({ ...f, sort_order: e.target.value }))}
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {editingId ? 'Save Changes' : 'Create Source'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Source?</DialogTitle>
            <DialogDescription className="text-slate-400">
              Contacts and deals tagged with this source will keep their record
              but the source label will become blank. Any webhook using this
              source must be reassigned first.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteId(null)}
              className="border-slate-700 bg-transparent text-slate-300 hover:bg-slate-800"
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
