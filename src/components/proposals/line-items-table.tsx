'use client';

import { useRef } from 'react';
import type { ProposalItem } from '@/types';
import { Button } from '@/components/ui/button';
import { Trash2, Plus, GripVertical } from 'lucide-react';
import { CatalogPicker } from './catalog-picker';
import type { CatalogItem } from '@/types';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface LineItemsTableProps {
  items: ProposalItem[];
  currency: string;
  onChange: (items: ProposalItem[]) => void;
}

function genId() {
  return Math.random().toString(36).slice(2);
}

function calcTotal(qty: number, price: number, disc: number) {
  return qty * price * (1 - disc / 100);
}

export function LineItemsTable({ items, currency, onChange }: LineItemsTableProps) {
  const [pickerOpen, setPickerOpen] = useState(false);

  function addFromCatalog(cat: CatalogItem) {
    const newItem: ProposalItem = {
      id: genId(),
      proposal_id: '',
      catalog_item_id: cat.id || null,
      name: cat.name || 'New Item',
      description: cat.description ?? null,
      quantity: 1,
      unit_price: cat.price ?? 0,
      discount_pct: 0,
      total: cat.price ?? 0,
      sort_order: items.length,
    };
    onChange([...items, newItem]);
  }

  function addBlank() {
    const newItem: ProposalItem = {
      id: genId(),
      proposal_id: '',
      catalog_item_id: null,
      name: '',
      description: null,
      quantity: 1,
      unit_price: 0,
      discount_pct: 0,
      total: 0,
      sort_order: items.length,
    };
    onChange([...items, newItem]);
  }

  function update(id: string, field: keyof ProposalItem, value: unknown) {
    onChange(items.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, [field]: value };
      updated.total = calcTotal(Number(updated.quantity), Number(updated.unit_price), Number(updated.discount_pct));
      return updated;
    }));
  }

  function remove(id: string) {
    onChange(items.filter(i => i.id !== id));
  }

  const fmt = (n: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(n);

  return (
    <div>
      {/* Table header */}
      <div className="hidden md:grid grid-cols-[32px_1fr_80px_120px_80px_100px_40px] gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-500 border-b border-slate-700">
        <div />
        <div>Item</div>
        <div className="text-center">Qty</div>
        <div className="text-right">Unit Price</div>
        <div className="text-right">Disc %</div>
        <div className="text-right">Total</div>
        <div />
      </div>

      {/* Rows */}
      <div className="divide-y divide-slate-800">
        {items.map(item => (
          <div key={item.id} className="grid grid-cols-[32px_1fr_80px_120px_80px_100px_40px] gap-2 px-3 py-2 items-start group">
            {/* Drag handle (visual only) */}
            <div className="flex items-center justify-center h-9 text-slate-600 group-hover:text-slate-400 cursor-grab">
              <GripVertical className="h-4 w-4" />
            </div>

            {/* Name + description */}
            <div className="min-w-0">
              <InlineInput
                value={item.name}
                onChange={v => update(item.id, 'name', v)}
                placeholder="Item name"
                className="font-medium text-white text-sm"
              />
              <InlineInput
                value={item.description ?? ''}
                onChange={v => update(item.id, 'description', v || null)}
                placeholder="Description (optional)"
                className="text-xs text-slate-400 mt-0.5"
              />
            </div>

            {/* Qty */}
            <div>
              <InlineNumberInput
                value={item.quantity}
                onChange={v => update(item.id, 'quantity', v)}
                className="text-center"
                min={0}
              />
            </div>

            {/* Unit price */}
            <div>
              <InlineNumberInput
                value={item.unit_price}
                onChange={v => update(item.id, 'unit_price', v)}
                className="text-right"
                step={0.01}
                min={0}
                prefix={currency === 'USD' ? '$' : undefined}
              />
            </div>

            {/* Discount */}
            <div>
              <InlineNumberInput
                value={item.discount_pct}
                onChange={v => update(item.id, 'discount_pct', v)}
                className="text-right"
                min={0}
                max={100}
                suffix="%"
              />
            </div>

            {/* Total */}
            <div className="flex items-center justify-end h-9">
              <span className="text-sm font-medium text-white">{fmt(item.total)}</span>
            </div>

            {/* Delete */}
            <div className="flex items-center justify-center h-9">
              <button
                type="button"
                onClick={() => remove(item.id)}
                className="text-slate-600 hover:text-red-400 transition-colors"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add buttons */}
      <div className="flex gap-2 px-3 pt-3">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setPickerOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Add from Catalog
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={addBlank}
        >
          <Plus className="h-3.5 w-3.5 mr-1.5" /> Custom Item
        </Button>
      </div>

      <CatalogPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addFromCatalog} />
    </div>
  );
}

// ── Inline editable cell components ────────────────────────

function InlineInput({ value, onChange, placeholder, className }: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <input
      ref={ref}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      className={cn(
        'w-full bg-transparent border-0 outline-none focus:bg-slate-800/80 focus:px-1.5 rounded-md transition-all placeholder:text-slate-600',
        className
      )}
    />
  );
}

function InlineNumberInput({ value, onChange, className, min, max, step, prefix, suffix }: {
  value: number;
  onChange: (v: number) => void;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
  prefix?: string;
  suffix?: string;
}) {
  return (
    <div className="relative flex items-center h-9">
      {prefix && <span className="absolute left-1 text-xs text-slate-500 pointer-events-none">{prefix}</span>}
      <input
        type="number"
        value={value}
        min={min}
        max={max}
        step={step ?? 1}
        onChange={e => onChange(parseFloat(e.target.value) || 0)}
        className={cn(
          'w-full bg-transparent border-0 outline-none focus:bg-slate-800/80 focus:px-1.5 rounded-md transition-all text-sm text-white',
          prefix && 'pl-3',
          suffix && 'pr-5',
          className
        )}
      />
      {suffix && <span className="absolute right-1 text-xs text-slate-500 pointer-events-none">{suffix}</span>}
    </div>
  );
}
