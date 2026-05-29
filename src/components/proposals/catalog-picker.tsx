'use client';

import { useState, useEffect } from 'react';
import type { CatalogItem } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, Package } from 'lucide-react';

interface CatalogPickerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (item: CatalogItem) => void;
}

function formatMoney(price: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(price);
}

export function CatalogPicker({ open, onOpenChange, onSelect }: CatalogPickerProps) {
  const [items, setItems] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch('/api/catalog')
      .then(r => r.json())
      .then((data: CatalogItem[]) => setItems(data.filter(i => i.is_active)))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = search
    ? items.filter(i => i.name.toLowerCase().includes(search.toLowerCase()) || (i.category ?? '').toLowerCase().includes(search.toLowerCase()))
    : items;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add from Catalog</DialogTitle>
        </DialogHeader>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input className="pl-9" placeholder="Search catalog…" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="max-h-80 overflow-y-auto space-y-1">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center py-8 text-center">
              <Package className="h-8 w-8 text-slate-600 mb-2" />
              <p className="text-sm text-slate-400">{search ? 'No items match.' : 'No active catalog items.'}</p>
            </div>
          ) : (
            filtered.map(item => (
              <button
                key={item.id}
                type="button"
                onClick={() => { onSelect(item); onOpenChange(false); setSearch(''); }}
                className="w-full flex items-start justify-between rounded-lg px-3 py-2.5 text-left hover:bg-slate-800 transition-colors group"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-white truncate">{item.name}</p>
                  {item.description && <p className="text-xs text-slate-400 truncate">{item.description}</p>}
                  {item.category && <p className="text-xs text-slate-500 mt-0.5">{item.category}</p>}
                </div>
                <div className="ml-3 shrink-0 text-right">
                  <p className="text-sm font-semibold text-white">{formatMoney(item.price, item.currency)}</p>
                  <p className="text-xs text-slate-400">/ {item.unit}</p>
                </div>
              </button>
            ))
          )}
        </div>
        <div className="pt-2 border-t border-slate-800">
          <Button variant="outline" size="sm" className="w-full" onClick={() => { onSelect({ id: '', name: '', price: 0, currency: 'USD', unit: 'unit', is_active: true, sort_order: 0, created_at: '', updated_at: '' }); onOpenChange(false); }}>
            + Add Custom Item
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
