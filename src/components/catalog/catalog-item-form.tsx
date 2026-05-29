'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import type { CatalogItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

interface CatalogItemFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item?: CatalogItem | null;
  onSaved: (item: CatalogItem) => void;
}

const UNIT_OPTIONS = ['unit', 'hour', 'day', 'month', 'year', 'project', 'license', 'user', 'seat'];

export function CatalogItemForm({ open, onOpenChange, item, onSaved }: CatalogItemFormProps) {
  const isEdit = !!item;
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    name: item?.name ?? '',
    description: item?.description ?? '',
    price: item?.price?.toString() ?? '0',
    currency: item?.currency ?? 'USD',
    unit: item?.unit ?? 'unit',
    category: item?.category ?? '',
  });

  function set(key: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        description: form.description.trim() || null,
        price: parseFloat(form.price) || 0,
        currency: form.currency,
        unit: form.unit,
        category: form.category.trim() || null,
      };
      const url = isEdit ? `/api/catalog/${item!.id}` : '/api/catalog';
      const method = isEdit ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to save'); }
      const saved = await res.json();
      toast.success(isEdit ? 'Item updated' : 'Item added to catalog');
      onSaved(saved);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Error saving item');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton>
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit Item' : 'Add Catalog Item'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="ci-name">Name *</Label>
            <Input id="ci-name" value={form.name} onChange={e => set('name', e.target.value)} placeholder="e.g. Web Design Package" required />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="ci-desc">Description</Label>
            <Textarea id="ci-desc" value={form.description} onChange={e => set('description', e.target.value)} placeholder="Brief description (optional)" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ci-price">Price</Label>
              <Input id="ci-price" type="number" min="0" step="0.01" value={form.price} onChange={e => set('price', e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ci-currency">Currency</Label>
              <Input id="ci-currency" value={form.currency} onChange={e => set('currency', e.target.value.toUpperCase())} maxLength={3} placeholder="USD" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ci-unit">Unit</Label>
              <select
                id="ci-unit"
                value={form.unit}
                onChange={e => set('unit', e.target.value)}
                className="flex h-9 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary"
              >
                {UNIT_OPTIONS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ci-category">Category</Label>
              <Input id="ci-category" value={form.category} onChange={e => set('category', e.target.value)} placeholder="e.g. Design" />
            </div>
          </div>
          <DialogFooter showCloseButton={false}>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>
              {saving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Saving…</> : isEdit ? 'Save Changes' : 'Add Item'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
