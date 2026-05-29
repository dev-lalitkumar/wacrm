'use client';

import type { Proposal, ProposalItem, Company } from '@/types';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(amount);
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface ProposalPreviewProps {
  proposal: Proposal;
  company: Company | null;
  onClose: () => void;
}

export function ProposalPreview({ proposal, company, onClose }: ProposalPreviewProps) {
  const items: ProposalItem[] = (proposal.items ?? []).sort((a, b) => a.sort_order - b.sort_order);
  const contact = proposal.contact as { name?: string; email?: string; phone?: string; company?: string } | null;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/90 flex flex-col">
      {/* Toolbar */}
      <div className="shrink-0 flex items-center justify-between bg-slate-900 border-b border-slate-800 px-6 py-3">
        <span className="text-sm font-medium text-slate-300">Preview — {proposal.proposal_number}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Scrollable preview */}
      <div className="flex-1 overflow-y-auto py-8 px-4">
        <div className="mx-auto max-w-2xl bg-white text-slate-900 rounded-xl shadow-2xl p-12 print:shadow-none">
          {/* Header */}
          <div className="flex justify-between items-start mb-8">
            <div>
              {company?.logo_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={company.logo_url} alt={company.name} className="h-14 w-auto object-contain mb-3" />
              )}
            </div>
            <div className="text-right">
              {company?.name && <p className="font-bold text-slate-900 text-lg">{company.name}</p>}
              {company?.email && <p className="text-sm text-slate-500">{company.email}</p>}
              {company?.phone && <p className="text-sm text-slate-500">{company.phone}</p>}
              {company?.address && <p className="text-sm text-slate-500">{company.address}</p>}
            </div>
          </div>

          <hr className="border-slate-200 mb-6" />

          <p className="text-xs text-slate-400 mb-1">{proposal.proposal_number}</p>
          <h1 className="text-2xl font-bold text-slate-900 mb-6">{proposal.title}</h1>

          {/* Client + dates */}
          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Prepared For</p>
              {contact?.name && <p className="text-sm font-semibold text-slate-900">{contact.name}</p>}
              {contact?.company && <p className="text-sm text-slate-600">{contact.company}</p>}
              {contact?.email && <p className="text-sm text-slate-500">{contact.email}</p>}
              {contact?.phone && <p className="text-sm text-slate-500">{contact.phone}</p>}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Details</p>
              <p className="text-sm text-slate-600">Date: {fmtDate(proposal.created_at)}</p>
              {proposal.valid_until && <p className="text-sm text-slate-600">Valid Until: {fmtDate(proposal.valid_until)}</p>}
            </div>
          </div>

          {/* Line items */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="bg-slate-50 rounded">
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Item</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Qty</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Unit Price</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Disc %</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map(item => (
                <tr key={item.id}>
                  <td className="p-2">
                    <p className="font-medium text-slate-900">{item.name}</p>
                    {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                  </td>
                  <td className="p-2 text-center text-slate-600">{item.quantity}</td>
                  <td className="p-2 text-right text-slate-600">{money(item.unit_price, proposal.currency)}</td>
                  <td className="p-2 text-right text-slate-500">{item.discount_pct > 0 ? `${item.discount_pct}%` : '—'}</td>
                  <td className="p-2 text-right font-medium text-slate-900">{money(item.total, proposal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-56 space-y-2">
              <div className="flex justify-between text-sm text-slate-600">
                <span>Subtotal</span><span>{money(proposal.subtotal, proposal.currency)}</span>
              </div>
              {proposal.discount_amount > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Discount</span><span>-{money(proposal.discount_amount, proposal.currency)}</span>
                </div>
              )}
              {proposal.tax_rate > 0 && (
                <div className="flex justify-between text-sm text-slate-600">
                  <span>Tax ({proposal.tax_rate}%)</span>
                  <span>{money(proposal.subtotal * proposal.tax_rate / 100, proposal.currency)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t border-slate-900">
                <span>Total</span><span>{money(proposal.total_amount, proposal.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {proposal.notes && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{proposal.notes}</p>
            </div>
          )}

          {/* Terms */}
          {proposal.terms && (
            <div className="mb-6">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Terms & Conditions</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{proposal.terms}</p>
            </div>
          )}

          <hr className="border-slate-200 mt-8 mb-4" />
          <p className="text-xs text-center text-slate-400">{proposal.proposal_number} · {company?.name ?? ''}</p>
        </div>
      </div>
    </div>
  );
}
