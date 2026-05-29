'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { CatalogItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Search,
  MoreHorizontal,
  Pencil,
  Trash2,
  Package,
  Loader2,
  ToggleLeft,
  ToggleRight,
} from 'lucide-react';
import { CatalogItemForm } from './catalog-item-form';

function formatMoney(price: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(price);
}

export function CatalogPage() {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<CatalogItem | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/catalog');
      if (!res.ok) throw new Error('Failed to load');
      setItems(await res.json());
    } catch {
      toast.error('Failed to load catalog');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function toggleActive(item: CatalogItem) {
    const res = await fetch(`/api/catalog/${item.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !item.is_active }),
    });
    if (res.ok) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, is_active: !i.is_active } : i));
      toast.success(item.is_active ? 'Item deactivated' : 'Item activated');
    }
  }

  async function handleDelete() {
    if (!deleteItem) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/catalog/${deleteItem.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error('Failed to delete');
      setItems(prev => prev.filter(i => i.id !== deleteItem.id));
      toast.success('Item deleted');
      setDeleteItem(null);
    } catch {
      toast.error('Failed to delete item');
    } finally {
      setDeleting(false);
    }
  }

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.category ?? '').toLowerCase().includes(search.toLowerCase()))
    : items;

  const byCategory: Record<string, CatalogItem[]> = {};
  filtered.forEach(i => {
    const cat = i.category || 'Uncategorized';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(i);
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800 px-6 py-4">
        <div>
          <h1 className="text-xl font-semibold text-white">Product Catalog</h1>
          <p className="text-sm text-slate-400">Manage products & services used in proposals</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Item
        </Button>
      </div>

      {/* Toolbar */}
      <div className="px-6 py-3 border-b border-slate-800">
        <div className="relative max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            className="pl-9"
            placeholder="Search items…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin mr-2" /> Loading…
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Package className="h-10 w-10 text-slate-600 mb-3" />
            <p className="text-slate-400 text-sm">
              {search ? 'No items match your search.' : 'No catalog items yet. Add your first product or service.'}
            </p>
            {!search && (
              <Button className="mt-4" onClick={() => { setEditing(null); setFormOpen(true); }}>
                <Plus className="mr-2 h-4 w-4" /> Add First Item
              </Button>
            )}
          </div>
        ) : (
          <div className="space-y-6">
            {Object.entries(byCategory).map(([cat, catItems]) => (
              <div key={cat}>
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {catItems.map(item => (
                    <div
                      key={item.id}
                      className={`rounded-lg border bg-slate-800/50 p-4 flex flex-col gap-2 ${!item.is_active ? 'opacity-50' : ''} border-slate-700`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.name}</p>
                          {item.description && <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{item.description}</p>}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={<Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" />}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="bg-slate-900 text-slate-100 ring-slate-700">
                            <DropdownMenuItem onClick={() => { setEditing(item); setFormOpen(true); }} className="focus:bg-slate-800">
                              <Pencil className="mr-2 h-4 w-4" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => toggleActive(item)} className="focus:bg-slate-800">
                              {item.is_active
                                ? <><ToggleLeft className="mr-2 h-4 w-4" /> Deactivate</>
                                : <><ToggleRight className="mr-2 h-4 w-4" /> Activate</>
                              }
                            </DropdownMenuItem>
                            <DropdownMenuSeparator className="bg-slate-800" />
                            <DropdownMenuItem onClick={() => setDeleteItem(item)} className="text-red-400 focus:bg-slate-800 focus:text-red-300">
                              <Trash2 className="mr-2 h-4 w-4" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-base font-semibold text-white">{formatMoney(item.price, item.currency)}</span>
                        <span className="text-xs text-slate-400">/ {item.unit}</span>
                        {!item.is_active && <Badge variant="outline" className="text-xs ml-auto border-slate-600 text-slate-500">Inactive</Badge>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Item Form Dialog */}
      <CatalogItemForm
        open={formOpen}
        onOpenChange={setFormOpen}
        item={editing}
        onSaved={saved => {
          setItems(prev => {
            const exists = prev.find(i => i.id === saved.id);
            return exists ? prev.map(i => i.id === saved.id ? saved : i) : [saved, ...prev];
          });
        }}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteItem} onOpenChange={open => !open && setDeleteItem(null)}>
        <DialogContent showCloseButton>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-slate-400">
            Are you sure you want to delete <strong className="text-white">{deleteItem?.name}</strong>? This cannot be undone.
          </p>
          <DialogFooter showCloseButton={false}>
            <Button variant="outline" onClick={() => setDeleteItem(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Deleting…</> : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
