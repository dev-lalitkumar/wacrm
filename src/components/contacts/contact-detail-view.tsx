'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';
import { canAssignContacts } from '@/lib/auth/permissions';
import type { Contact, Tag, CustomField, Profile } from '@/types';
import { QuickFollowup } from '@/components/shared/quick-followup';
import { ActivityHistory } from '@/components/shared/activity-history';
import { ContactInfoCard } from '@/components/shared/contact-info-card';
import { CollapsibleSection } from '@/components/shared/collapsible-section';
import { ComposeEmailDialog } from '@/components/email/compose-dialog';
import { useGmailStatus } from '@/hooks/use-gmail-status';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Phone,
  Mail,
  Check,
  Loader2,
  StickyNote,
  Tag as TagIcon,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';

interface ContactDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contactId: string | null;
  onUpdated: () => void;
}

export function ContactDetailView({
  open,
  onOpenChange,
  contactId,
  onUpdated,
}: ContactDetailViewProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const canAssign = canAssignContacts(profile?.role ?? null);
  const gmail = useGmailStatus();
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);

  // ─── Loaded data ────────────────────────────────────────────────────────────
  const [contact, setContact] = useState<Contact | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(false);
  const [copiedPhone, setCopiedPhone] = useState(false);

  // ─── Update-tab form state ──────────────────────────────────────────────────
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editCompany, setEditCompany] = useState('');
  const [editAssignedTo, setEditAssignedTo] = useState('');
  const [editCustomData, setEditCustomData] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // ─── Accordion state (Followup tab) ────────────────────────────────────────
  const [followupOpen, setFollowupOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ─── Summary data for collapsed section headers ────────────────────────────
  const [lastFollowup, setLastFollowup] = useState<{ channel: string; created_at: string } | null>(null);
  const [lastNote, setLastNote] = useState<{ note_text: string; created_at: string } | null>(null);

  // ─── Followup-tab: note adding ──────────────────────────────────────────────
  const [newNote, setNewNote] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // ─── Tags toggling (shared between Followup and Update tabs) ───────────────
  const [savingTags, setSavingTags] = useState(false);

  // ─── Fetch all ──────────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!contactId) return;
    setLoading(true);

    const profilePromise = canAssign
      ? supabase
          .from('profiles')
          .select('id, full_name, email')
          .eq('is_active', true)
          .order('full_name')
      : Promise.resolve({ data: [] as Profile[], error: null });

    const [contactRes, tagsRes, contactTagsRes, customFieldsRes, profilesRes, lastFollowupRes, lastNoteRes] =
      await Promise.all([
        supabase
          .from('contacts')
          .select('*, source:sources(id, name, key)')
          .eq('id', contactId)
          .single(),
        supabase.from('tags').select('*').order('name'),
        supabase.from('contact_tags').select('tag_id').eq('contact_id', contactId),
        supabase
          .from('custom_fields')
          .select('*')
          .eq('applies_to', 'contact')
          .order('sort_order'),
        profilePromise,
        supabase
          .from('contact_followups')
          .select('channel, created_at')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('contact_notes')
          .select('note_text, created_at')
          .eq('contact_id', contactId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const c = contactRes.data as Contact | null;
    setContact(c);
    setAllTags((tagsRes.data as Tag[]) ?? []);
    setContactTagIds(((contactTagsRes.data ?? []) as { tag_id: string }[]).map((ct) => ct.tag_id));
    setCustomFields((customFieldsRes.data as CustomField[]) ?? []);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setLastFollowup(
      lastFollowupRes.data
        ? { channel: lastFollowupRes.data.channel, created_at: lastFollowupRes.data.created_at }
        : null
    );
    setLastNote(
      lastNoteRes.data
        ? { note_text: lastNoteRes.data.note_text, created_at: lastNoteRes.data.created_at }
        : null
    );

    // Sync form fields
    if (c) {
      setEditName(c.name ?? '');
      setEditPhone(c.phone ?? '');
      setEditEmail(c.email ?? '');
      setEditCompany(c.company ?? '');
      setEditAssignedTo(c.assigned_to ?? '');
      setEditCustomData((c.custom_data ?? {}) as Record<string, unknown>);
    }

    setLoading(false);
  }, [contactId, canAssign, supabase]);

  useEffect(() => {
    if (open && contactId) {
      // Resetting accordion state + form drafts on open is intentional
      // synchronous setState here — these are local UI bits that key
      // off the open transition, not external state we're syncing.
      /* eslint-disable react-hooks/set-state-in-effect */
      setFollowupOpen(false);
      setNoteOpen(false);
      setTagsOpen(false);
      setNewNote('');
      /* eslint-enable react-hooks/set-state-in-effect */
      fetchAll();
    }
  }, [open, contactId, fetchAll]);

  // ─── Actions ────────────────────────────────────────────────────────────────
  async function copyPhone() {
    if (!contact) return;
    await navigator.clipboard.writeText(contact.phone);
    setCopiedPhone(true);
    setTimeout(() => setCopiedPhone(false), 2000);
  }

  async function toggleTag(tagId: string) {
    if (!contactId) return;
    setSavingTags(true);
    const isSelected = contactTagIds.includes(tagId);
    if (isSelected) {
      const { error } = await supabase
        .from('contact_tags')
        .delete()
        .eq('contact_id', contactId)
        .eq('tag_id', tagId);
      if (!error) setContactTagIds((prev) => prev.filter((id) => id !== tagId));
    } else {
      const { error } = await supabase
        .from('contact_tags')
        .insert({ contact_id: contactId, tag_id: tagId });
      if (!error) setContactTagIds((prev) => [...prev, tagId]);
    }
    setSavingTags(false);
    onUpdated();
  }

  async function addNote() {
    if (!contactId || !newNote.trim()) return;
    setSavingNote(true);
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error('Not authenticated');
      setSavingNote(false);
      return;
    }
    const { error } = await supabase.from('contact_notes').insert({
      contact_id: contactId,
      user_id: user.id,
      note_text: newNote.trim(),
    });
    if (error) {
      toast.error('Failed to add note');
    } else {
      toast.success('Note added');
      setNewNote('');
      setNoteOpen(false);
      fetchAll();
    }
    setSavingNote(false);
  }

  async function saveAll() {
    if (!contactId || !editPhone.trim()) {
      toast.error('Phone is required');
      return;
    }
    setSaving(true);

    const updates: Record<string, unknown> = {
      name: editName.trim() || null,
      phone: editPhone.trim(),
      email: editEmail.trim() || null,
      company: editCompany.trim() || null,
      // source_id intentionally omitted — immutable after creation (DB trigger 017)
      custom_data: editCustomData,
      updated_at: new Date().toISOString(),
    };
    if (canAssign) updates.assigned_to = editAssignedTo || null;

    const { error: contactError } = await supabase
      .from('contacts')
      .update(updates)
      .eq('id', contactId);

    if (contactError) {
      toast.error('Failed to save contact');
      setSaving(false);
      return;
    }

    // Sync tags: delete all + re-insert selected
    await supabase.from('contact_tags').delete().eq('contact_id', contactId);
    if (contactTagIds.length > 0) {
      await supabase.from('contact_tags').insert(
        contactTagIds.map((tagId) => ({ contact_id: contactId, tag_id: tagId }))
      );
    }

    setSaving(false);
    toast.success('Changes saved');
    fetchAll();
    onUpdated();
  }

  // ─── Custom field input helper ──────────────────────────────────────────────
  function renderFieldInput(field: CustomField, val: unknown, onChange: (v: unknown) => void) {
    if (field.field_type === 'select') {
      const opts = (field.field_options?.options ?? []) as string[];
      return (
        <select
          value={String(val ?? '')}
          onChange={(e) => onChange(e.target.value || null)}
          className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        >
          <option value="">— none —</option>
          {opts.map((o) => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }
    if (field.field_type === 'multi_select') {
      const opts = (field.field_options?.options ?? []) as string[];
      const selected: string[] = Array.isArray(val) ? (val as string[]) : [];
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => {
                const next = selected.includes(o)
                  ? selected.filter((s) => s !== o)
                  : [...selected, o];
                onChange(next.length ? next : null);
              }}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                selected.includes(o)
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }
    if (field.field_type === 'number') {
      return (
        <Input
          type="number"
          value={val == null ? '' : String(val)}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          className="border-slate-700 bg-slate-800 text-white"
        />
      );
    }
    if (field.field_type === 'file') {
      return (
        <div className="space-y-1">
          {val != null && val !== '' && (
            <a href={String(val)} target="_blank" rel="noopener noreferrer"
              className="block text-xs text-primary hover:underline truncate">
              Current file ↗
            </a>
          )}
          <Input
            type="url"
            placeholder="Paste file URL…"
            value={val == null ? '' : String(val)}
            onChange={(e) => onChange(e.target.value || null)}
            className="border-slate-700 bg-slate-800 text-white text-xs"
          />
        </div>
      );
    }
    // text (default)
    return (
      <Input
        type="text"
        value={val == null ? '' : String(val)}
        onChange={(e) => onChange(e.target.value || null)}
        className="border-slate-700 bg-slate-800 text-white"
      />
    );
  }

  // ─── Derived ─────────────────────────────────────────────────────────────────
  function getInitials(name?: string | null) {
    if (!name) return '?';
    return name.split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);
  }

  const assignee = contact?.assigned_to
    ? profiles.find((p) => p.id === contact.assigned_to) ?? null
    : null;

  const contactWithTags = contact
    ? {
        ...contact,
        tags: allTags.filter((t) => contactTagIds.includes(t.id)),
      }
    : null;

  // ─── Collapsed summaries ─────────────────────────────────────────────────────
  const followupSummary = lastFollowup ? (
    <span className="flex items-center gap-1.5">
      <span className="inline-flex items-center rounded-full bg-slate-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-300 capitalize">
        {lastFollowup.channel}
      </span>
      <span className="text-slate-500">{timeAgo(lastFollowup.created_at)}</span>
    </span>
  ) : (
    <span className="text-slate-600">No followups yet</span>
  );

  const noteSummary = lastNote ? (
    <span className="flex items-center gap-1.5">
      <span className="text-slate-400 truncate max-w-[160px]">
        &ldquo;{lastNote.note_text.slice(0, 45)}{lastNote.note_text.length > 45 ? '…' : ''}&rdquo;
      </span>
      <span className="text-slate-500 shrink-0">{timeAgo(lastNote.created_at)}</span>
    </span>
  ) : (
    <span className="text-slate-600">No notes yet</span>
  );

  const activeTags = allTags.filter((t) => contactTagIds.includes(t.id));
  const tagsSummary = activeTags.length > 0 ? (
    <span className="flex items-center gap-1 flex-wrap">
      {activeTags.slice(0, 3).map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: t.color + '20', color: t.color }}
        >
          {t.name}
        </span>
      ))}
      {activeTags.length > 3 && (
        <span className="text-[10px] text-slate-500">+{activeTags.length - 3} more</span>
      )}
    </span>
  ) : (
    <span className="text-slate-600">No tags</span>
  );

  // ─── Render ───────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0"
      >
        {loading || !contact ? (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex flex-col h-full overflow-hidden">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <SheetHeader className="shrink-0 p-4 border-b border-slate-700/50">
              <div className="flex items-center gap-3">
                <Avatar className="size-11 shrink-0 border border-slate-700">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-white truncate text-base">
                    {contact.name || 'Unknown'}
                  </SheetTitle>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1 text-xs text-slate-400">
                    <button
                      type="button"
                      onClick={copyPhone}
                      className="flex items-center gap-1 hover:text-primary transition-colors cursor-pointer"
                    >
                      <Phone className="size-3" />
                      {contact.phone}
                      {copiedPhone ? (
                        <Check className="size-3 text-primary" />
                      ) : null}
                    </button>
                    {contact.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="size-3" />
                        {contact.email}
                        {gmail.connected && (
                          <button
                            type="button"
                            onClick={() => setEmailComposeOpen(true)}
                            className="ml-1 rounded px-1.5 py-0.5 text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors cursor-pointer"
                          >
                            Send Email
                          </button>
                        )}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </SheetHeader>

            {/* ── Contact Info Card — always visible ──────────────────────── */}
            <div className="shrink-0 border-b border-slate-700/40 px-4 py-3">
              {contactWithTags && (
                <ContactInfoCard
                  contact={contactWithTags}
                  customFields={customFields}
                  assignee={assignee}
                />
              )}
            </div>

            {/* ── Tabs ────────────────────────────────────────────────────── */}
            <Tabs
              defaultValue="history"
              className="flex flex-1 flex-col overflow-hidden min-h-0"
            >
              <TabsList className="shrink-0 mx-4 mt-2 grid grid-cols-3 bg-slate-800 border border-slate-700">
                <TabsTrigger
                  value="history"
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 text-xs"
                >
                  History
                </TabsTrigger>
                <TabsTrigger
                  value="followup"
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 text-xs"
                >
                  Followup
                </TabsTrigger>
                <TabsTrigger
                  value="update"
                  className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 text-xs"
                >
                  Update
                </TabsTrigger>
              </TabsList>

              {/* History tab */}
              <TabsContent
                value="history"
                className="flex-1 overflow-y-auto px-4 py-3"
              >
                {contactId && (
                  <ActivityHistory entityType="contact" entityId={contactId} />
                )}
              </TabsContent>

              {/* Followup tab */}
              <TabsContent
                value="followup"
                className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
              >
                {/* ── Followup — collapsible ──────────────────────── */}
                {contactId && (
                  <CollapsibleSection
                    title="Followup"
                    summary={followupSummary}
                    open={followupOpen}
                    onToggle={() => setFollowupOpen((p) => !p)}
                  >
                    <QuickFollowup
                      entityType="contact"
                      entityId={contactId}
                      onSaved={() => { fetchAll(); }}
                      showHistory={false}
                      onComposeEmail={contact?.email ? () => setEmailComposeOpen(true) : undefined}
                    />
                  </CollapsibleSection>
                )}

                {/* ── Note — collapsible ──────────────────────────── */}
                <CollapsibleSection
                  title="Note"
                  icon={<StickyNote className="size-3.5" />}
                  summary={noteSummary}
                  open={noteOpen}
                  onToggle={() => setNoteOpen((p) => !p)}
                >
                  <div className="space-y-2 pt-1">
                    <Textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Write a note…"
                      className="bg-slate-800 border-slate-700 text-white placeholder:text-slate-500 min-h-[72px] text-sm resize-none"
                      autoFocus={noteOpen}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={addNote}
                        disabled={!newNote.trim() || savingNote}
                        className="bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {savingNote && <Loader2 className="size-3.5 animate-spin" />}
                        Add Note
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => { setNoteOpen(false); setNewNote(''); }}
                        className="text-slate-400 hover:text-white"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </CollapsibleSection>

                {/* ── Tags — collapsible ──────────────────────────── */}
                {allTags.length > 0 && (
                  <CollapsibleSection
                    title="Tags"
                    icon={<TagIcon className="size-3.5" />}
                    summary={tagsSummary}
                    open={tagsOpen}
                    onToggle={() => setTagsOpen((p) => !p)}
                  >
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {allTags.map((tag) => {
                        const selected = contactTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() => toggleTag(tag.id)}
                            disabled={savingTags}
                            className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer disabled:opacity-50"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                              ...(selected ? { boxShadow: `0 0 0 2px ${tag.color}` } : { opacity: 0.55 }),
                            }}
                          >
                            {selected && <Check className="size-2.5 mr-1" />}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </CollapsibleSection>
                )}
              </TabsContent>

              {/* Update tab */}
              <TabsContent
                value="update"
                className="flex-1 overflow-y-auto px-4 py-3 space-y-3"
              >
                {/* Standard contact fields */}
                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">Name</Label>
                  <Input
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">
                    Phone <span className="text-red-400">*</span>
                  </Label>
                  <Input
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">Email</Label>
                  <Input
                    type="email"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>

                <div className="grid gap-2">
                  <Label className="text-slate-300 text-xs">Company</Label>
                  <Input
                    value={editCompany}
                    onChange={(e) => setEditCompany(e.target.value)}
                    className="border-slate-700 bg-slate-800 text-white"
                  />
                </div>

                {canAssign && (
                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Assigned To</Label>
                    <select
                      value={editAssignedTo}
                      onChange={(e) => setEditAssignedTo(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom fields — same visual rhythm as standard fields, no separator */}
                {customFields.map((field) => (
                  <div key={field.id} className="grid gap-2">
                    <Label className="text-slate-300 text-xs">{field.field_name}</Label>
                    {renderFieldInput(
                      field,
                      editCustomData[field.id],
                      (v) => setEditCustomData((prev) => ({ ...prev, [field.id]: v }))
                    )}
                  </div>
                ))}

                {/* Tags editor */}
                {allTags.length > 0 && (
                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Tags</Label>
                    <div className="flex flex-wrap gap-1.5">
                      {allTags.map((tag) => {
                        const selected = contactTagIds.includes(tag.id);
                        return (
                          <button
                            key={tag.id}
                            type="button"
                            onClick={() =>
                              setContactTagIds((prev) =>
                                selected
                                  ? prev.filter((id) => id !== tag.id)
                                  : [...prev, tag.id]
                              )
                            }
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                              selected ? 'opacity-100' : 'opacity-50 hover:opacity-80'
                            }`}
                            style={{ backgroundColor: tag.color + '20', color: tag.color }}
                          >
                            {selected && <Check className="size-2.5 mr-1" />}
                            {tag.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Save */}
                <Button
                  onClick={saveAll}
                  disabled={saving || !editPhone.trim()}
                  className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                >
                  {saving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Saving…
                    </>
                  ) : (
                    'Save Changes'
                  )}
                </Button>
              </TabsContent>
            </Tabs>
          </div>
        )}
      </SheetContent>

      {/* Email compose dialog */}
      {contact && (
        <ComposeEmailDialog
          open={emailComposeOpen}
          onClose={() => setEmailComposeOpen(false)}
          contact={{
            id: contact.id,
            name: contact.name ?? undefined,
            email: contact.email ?? undefined,
          }}
        />
      )}
    </Sheet>
  );
}
