'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { canAssignContacts } from '@/lib/auth/permissions';
import type { Contact, Tag, ContactTag, Profile } from '@/types';
import { SourceSelect } from '@/components/shared/source-select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';

interface ContactFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contact?: Contact | null;
  contactTags?: ContactTag[];
  onSaved: () => void;
}

export function ContactForm({
  open,
  onOpenChange,
  contact,
  contactTags = [],
  onSaved,
}: ContactFormProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const isEdit = !!contact;
  const canAssign = canAssignContacts(profile?.role ?? null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [assignedTo, setAssignedTo] = useState('');
  const [sourceId, setSourceId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [tags, setTags] = useState<Tag[]>([]);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);

  const [profiles, setProfiles] = useState<Profile[]>([]);

  useEffect(() => {
    if (open) {
      setName(contact?.name ?? '');
      setPhone(contact?.phone ?? '');
      setEmail(contact?.email ?? '');
      setCompany(contact?.company ?? '');
      setAssignedTo(contact?.assigned_to ?? '');
      setSourceId(contact?.source_id ?? null);
      setSelectedTagIds(contactTags.map((ct) => ct.tag_id));
      fetchTags();
      if (canAssign) fetchProfiles();
    }
    // Inputs are intentional — re-syncing on contactTags/fetcher
    // identity changes would either spam the network or stomp
    // user edits as the parent rerenders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, contact, canAssign]);

  async function fetchTags() {
    setLoadingTags(true);
    const { data } = await supabase
      .from('tags')
      .select('*')
      .order('name');
    if (data) setTags(data);
    setLoadingTags(false);
  }

  async function fetchProfiles() {
    // Only active members are valid assignees; deactivated ones
    // can no longer access anything via RLS.
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .eq('is_active', true)
      .order('full_name');
    if (data) setProfiles(data as Profile[]);
  }

  function toggleTag(tagId: string) {
    setSelectedTagIds((prev) =>
      prev.includes(tagId)
        ? prev.filter((id) => id !== tagId)
        : [...prev, tagId]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!phone.trim()) {
      toast.error('Phone number is required');
      return;
    }

    setSaving(true);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error('Not authenticated');

      let contactId = contact?.id;

      if (isEdit && contactId) {
        const updates: Record<string, unknown> = {
          name: name.trim() || null,
          phone: phone.trim(),
          email: email.trim() || null,
          company: company.trim() || null,
          source_id: sourceId || null,
          updated_at: new Date().toISOString(),
        };
        // Only roles that can reassign send `assigned_to`. Sending it
        // unconditionally would let an Executive's edit silently clear
        // the assignment on submit.
        if (canAssign) {
          updates.assigned_to = assignedTo || null;
        }
        const { error } = await supabase
          .from('contacts')
          .update(updates)
          .eq('id', contactId);
        if (error) throw error;
      } else {
        const insertPayload: Record<string, unknown> = {
          user_id: user.id,
          name: name.trim() || null,
          phone: phone.trim(),
          email: email.trim() || null,
          company: company.trim() || null,
          source_id: sourceId || null,
        };
        if (canAssign && assignedTo) {
          insertPayload.assigned_to = assignedTo;
        }
        const { data, error } = await supabase
          .from('contacts')
          .insert(insertPayload)
          .select('id')
          .single();
        if (error) throw error;
        contactId = data.id;
      }

      // Sync tags
      if (contactId) {
        await supabase
          .from('contact_tags')
          .delete()
          .eq('contact_id', contactId);

        if (selectedTagIds.length > 0) {
          const tagRows = selectedTagIds.map((tag_id) => ({
            contact_id: contactId!,
            tag_id,
          }));
          const { error: tagError } = await supabase
            .from('contact_tags')
            .insert(tagRows);
          if (tagError) throw tagError;
        }
      }

      toast.success(isEdit ? 'Contact updated' : 'Contact created');
      onOpenChange(false);
      onSaved();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to save contact';
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white">
            {isEdit ? 'Edit Contact' : 'Add Contact'}
          </DialogTitle>
          <DialogDescription className="text-slate-400">
            {isEdit
              ? 'Update the contact details below.'
              : 'Fill in the details to create a new contact.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="cf-name" className="text-slate-300">
              Name
            </Label>
            <Input
              id="cf-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-phone" className="text-slate-300">
              Phone <span className="text-red-400">*</span>
            </Label>
            <Input
              id="cf-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+1 234 567 8900"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
            <p className="text-xs text-slate-500">
              Include country code, e.g. +1 for US
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-email" className="text-slate-300">
              Email
            </Label>
            <Input
              id="cf-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="john@example.com"
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-company" className="text-slate-300">
              Company
            </Label>
            <Input
              id="cf-company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Acme Inc."
              className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="cf-source" className="text-slate-300">
              Source
            </Label>
            <SourceSelect value={sourceId} onChange={setSourceId} />
          </div>

          {canAssign && (
            <div className="space-y-2">
              <Label htmlFor="cf-assigned" className="text-slate-300">
                Assigned to
              </Label>
              <select
                id="cf-assigned"
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
              >
                <option value="">Unassigned</option>
                {profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name || p.email}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                Executives only see contacts assigned to them.
              </p>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-slate-300">Tags</Label>
            {loadingTags ? (
              <div className="flex items-center gap-2 text-slate-500 text-sm">
                <Loader2 className="size-3 animate-spin" />
                Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <p className="text-xs text-slate-500">
                No tags available. Create tags in Settings.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => {
                  const selected = selectedTagIds.includes(tag.id);
                  return (
                    <button
                      key={tag.id}
                      type="button"
                      onClick={() => toggleTag(tag.id)}
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors cursor-pointer ${
                        selected
                          ? 'ring-2 ring-primary ring-offset-1 ring-offset-slate-900'
                          : 'opacity-60 hover:opacity-100'
                      }`}
                      style={{
                        backgroundColor: tag.color + '20',
                        color: tag.color,
                        borderColor: tag.color,
                      }}
                    >
                      {tag.name}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              {saving && <Loader2 className="size-4 animate-spin" />}
              {isEdit ? 'Update' : 'Create'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
