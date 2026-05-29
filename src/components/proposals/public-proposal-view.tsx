'use client';

import { useState } from 'react';
import type { Proposal, ProposalItem, Company } from '@/types';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

function money(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 2 }).format(amount);
}
function fmtDate(d?: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

interface PublicProposalViewProps {
  proposal: Proposal;
  company: Company | null;
  token: string;
}

export function PublicProposalView({ proposal, company, token }: PublicProposalViewProps) {
  const [status, setStatus] = useState(proposal.status);
  const [acting, setActing] = useState<'accepted' | 'rejected' | null>(null);

  const contact = proposal.contact as { name?: string; email?: string; phone?: string; company?: string } | null;
  const items: ProposalItem[] = (proposal.items ?? []).sort((a, b) => a.sort_order - b.sort_order);

  async function handleAction(action: 'accepted' | 'rejected') {
    setActing(action);
    try {
      const res = await fetch(`/api/proposals/${proposal.id}/public`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, token }),
      });
      if (res.ok) setStatus(action);
    } catch {
      // Silent fail - the page still shows the proposal
    } finally {
      setActing(null);
    }
  }

  const isFinal = status === 'accepted' || status === 'rejected';

  return (
    <div className="min-h-screen bg-slate-100 py-8 px-4">
      <div className="mx-auto max-w-2xl bg-white rounded-2xl shadow-xl overflow-hidden">
        {/* Status banner */}
        {status === 'accepted' && (
          <div className="bg-green-500 text-white text-center py-3 text-sm font-semibold flex items-center justify-center gap-2">
            <CheckCircle className="h-4 w-4" /> You accepted this proposal
          </div>
        )}
        {status === 'rejected' && (
          <div className="bg-red-500 text-white text-center py-3 text-sm font-semibold flex items-center justify-center gap-2">
            <XCircle className="h-4 w-4" /> You declined this proposal
          </div>
        )}

        {/* Proposal body */}
        <div className="p-10">
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

          <div className="grid grid-cols-2 gap-8 mb-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Prepared For</p>
              {contact?.name && <p className="text-sm font-semibold text-slate-900">{contact.name}</p>}
              {contact?.company && <p className="text-sm text-slate-600">{contact.company}</p>}
              {contact?.email && <p className="text-sm text-slate-500">{contact.email}</p>}
            </div>
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Details</p>
              <p className="text-sm text-slate-600">Date: {fmtDate(proposal.created_at)}</p>
              {proposal.valid_until && <p className="text-sm text-slate-600">Valid Until: {fmtDate(proposal.valid_until)}</p>}
            </div>
          </div>

          {/* Items */}
          <table className="w-full text-sm mb-6">
            <thead>
              <tr className="bg-slate-50">
                <th className="text-left text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Item</th>
                <th className="text-center text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Qty</th>
                <th className="text-right text-xs font-semibold uppercase tracking-wider text-slate-500 p-2">Price</th>
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
                  <td className="p-2 text-right font-medium text-slate-900">{money(item.total, proposal.currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="flex justify-end mb-8">
            <div className="w-52 space-y-2">
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
              <div className="flex justify-between font-bold text-base text-slate-900 pt-2 border-t border-slate-300">
                <span>Total</span><span>{money(proposal.total_amount, proposal.currency)}</span>
              </div>
            </div>
          </div>

          {/* Notes */}
          {proposal.notes && (
            <div className="mb-6 p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Notes</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{proposal.notes}</p>
            </div>
          )}

          {/* Terms */}
          {proposal.terms && (
            <div className="mb-8 p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">Terms & Conditions</p>
              <p className="text-sm text-slate-600 whitespace-pre-line">{proposal.terms}</p>
            </div>
          )}

          {/* Action buttons */}
          {!isFinal && (
            <div className="flex gap-3 justify-center pt-4 border-t border-slate-200">
              <Button
                size="lg"
                className="flex-1 max-w-xs bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAction('accepted')}
                disabled={!!acting}
              >
                {acting === 'accepted' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <CheckCircle className="h-4 w-4 mr-2" />}
                Accept Proposal
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="flex-1 max-w-xs border-red-300 text-red-500 hover:bg-red-50"
                onClick={() => handleAction('rejected')}
                disabled={!!acting}
              >
                {acting === 'rejected' ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <XCircle className="h-4 w-4 mr-2" />}
                Decline
              </Button>
            </div>
          )}
        </div>

        <div className="px-10 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <p className="text-xs text-slate-400">{proposal.proposal_number} · {company?.name ?? ''}</p>
        </div>
      </div>
    </div>
  );
}
