'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import type { Proposal, ProposalTemplate } from '@/types';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Loader2, Mail, MessageSquare } from 'lucide-react';
import { interpolate } from '@/lib/proposals/template-interpolator';

interface SendProposalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  proposal: Proposal;
  onSent: () => void;
}

function formatMoney(amount: number, currency: string) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', minimumFractionDigits: 0 }).format(amount);
}

export function SendProposalDialog({ open, onOpenChange, proposal, onSent }: SendProposalDialogProps) {
  const [activeTab, setActiveTab] = useState<'email' | 'whatsapp'>('email');
  const [templates, setTemplates] = useState<ProposalTemplate[]>([]);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [waBody, setWaBody] = useState('');
  const [sending, setSending] = useState(false);

  const appUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const proposalLink = `${appUrl}/p/${proposal.public_token}`;

  const vars = {
    contact_name: (proposal.contact as { name?: string } | null)?.name ?? 'there',
    proposal_title: proposal.title,
    proposal_link: proposalLink,
    total_amount: formatMoney(proposal.total_amount, proposal.currency),
    valid_until: proposal.valid_until
      ? new Date(proposal.valid_until).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      : 'N/A',
  };

  useEffect(() => {
    if (!open) return;
    fetch('/api/proposal-templates')
      .then(r => r.ok ? r.json() : [])
      .then((data: ProposalTemplate[]) => {
        setTemplates(data);
        const emailTpl = data.find(t => t.channel === 'email' && t.is_default);
        const waTpl = data.find(t => t.channel === 'whatsapp' && t.is_default);
        if (emailTpl) {
          setEmailSubject(interpolate(emailTpl.subject ?? 'Proposal: {{proposal_title}}', vars));
          setEmailBody(interpolate(emailTpl.body, vars));
        } else {
          setEmailSubject(`Proposal: ${proposal.title}`);
          setEmailBody(`Hi ${vars.contact_name},\n\nPlease find your proposal here: ${proposalLink}\n\nTotal: ${vars.total_amount}`);
        }
        if (waTpl) {
          setWaBody(interpolate(waTpl.body, vars));
        } else {
          setWaBody(`Hi ${vars.contact_name}! Your proposal "${proposal.title}" (${vars.total_amount}) is ready: ${proposalLink}`);
        }
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, proposal.id]);

  async function handleSend() {
    setSending(true);
    try {
      const body = activeTab === 'email'
        ? { channel: 'email', subject: emailSubject, message: emailBody }
        : { channel: 'whatsapp', message: waBody };

      const res = await fetch(`/api/proposals/${proposal.id}/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error ?? 'Failed to send');
      }

      toast.success(`Proposal sent via ${activeTab === 'email' ? 'email' : 'WhatsApp'}`);
      onSent();
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send proposal');
    } finally {
      setSending(false);
    }
  }

  const contact = proposal.contact as { name?: string; email?: string; phone?: string } | null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Send Proposal</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={v => setActiveTab(v as 'email' | 'whatsapp')}>
          <TabsList className="w-full">
            <TabsTrigger value="email" className="flex-1 gap-2">
              <Mail className="h-4 w-4" /> Email
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="flex-1 gap-2">
              <MessageSquare className="h-4 w-4" /> WhatsApp
            </TabsTrigger>
          </TabsList>

          <TabsContent value="email" className="space-y-3 mt-4">
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <span className="text-slate-400">To: </span>
              <span className="text-white">{contact?.email ?? <span className="text-red-400">No email on contact</span>}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Subject</Label>
              <Input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={emailBody} onChange={e => setEmailBody(e.target.value)} rows={8} className="font-mono text-xs" />
            </div>
            <p className="text-xs text-slate-500">
              Variables: {'{{contact_name}}'}, {'{{proposal_title}}'}, {'{{proposal_link}}'}, {'{{total_amount}}'}, {'{{valid_until}}'}
            </p>
          </TabsContent>

          <TabsContent value="whatsapp" className="space-y-3 mt-4">
            <div className="rounded-lg bg-slate-800/60 px-3 py-2 text-sm">
              <span className="text-slate-400">To: </span>
              <span className="text-white">{contact?.phone ?? <span className="text-red-400">No phone on contact</span>}</span>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <Textarea value={waBody} onChange={e => setWaBody(e.target.value)} rows={8} className="font-mono text-xs" />
            </div>
            <p className="text-xs text-slate-500">
              Variables: {'{{contact_name}}'}, {'{{proposal_title}}'}, {'{{proposal_link}}'}, {'{{total_amount}}'}, {'{{valid_until}}'}
            </p>
          </TabsContent>
        </Tabs>

        <DialogFooter showCloseButton={false}>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>Cancel</Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Sending…</> : `Send via ${activeTab === 'email' ? 'Email' : 'WhatsApp'}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
