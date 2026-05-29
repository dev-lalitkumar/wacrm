'use client';

import { useState, useEffect, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import type { Contact, Tag, ContactTag, CustomField, Profile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
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
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Search,
  Plus,
  Upload,
  MoreHorizontal,
  Pencil,
  Trash2,
  Loader2,
  Users,
  ChevronLeft,
  ChevronRight,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from '@/components/ui/popover';
import { ContactForm } from '@/components/contacts/contact-form';
import { ContactDetailView } from '@/components/contacts/contact-detail-view';
import { ImportModal } from '@/components/contacts/import-modal';
import { useAuth } from '@/hooks/use-auth';
import { canFilterAssignees } from '@/lib/auth/permissions';
import { getAssignableProfiles } from '@/lib/auth/assignable-profiles';

const PAGE_SIZE = 25;

type ReminderTab = 'today_missed' | 'all' | 'today' | 'missed' | 'upcoming';
interface ReminderCounts { today_missed: number; all: number; today: number; missed: number; upcoming: number; }

interface ContactWithTags extends Contact {
  tags?: Tag[];
}

export default function ContactsPage() {
  const supabase = createClient();
  const { profile } = useAuth();
  const showAssigneeFilter = canFilterAssignees(profile?.role ?? null);

  const [assignableProfiles, setAssignableProfiles] = useState<Profile[]>([]);
  const [assigneeFilter, setAssigneeFilter] = useState<string[]>([]);

  const [contacts, setContacts] = useState<ContactWithTags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [reminderTab, setReminderTab] = useState<ReminderTab>('today_missed');
  const [reminderCounts, setReminderCounts] = useState<ReminderCounts>({ today_missed: 0, all: 0, today: 0, missed: 0, upcoming: 0 });
  const [customTextFields, setCustomTextFields] = useState<CustomField[]>([]);
  const [filterFields, setFilterFields] = useState<CustomField[]>([]);
  const [activeFilters, setActiveFilters] = useState<Record<string, string[]>>({});
  const [displayCustomFields, setDisplayCustomFields] = useState<CustomField[]>([]);
  const [assigneesMap, setAssigneesMap] = useState<Record<string, Profile>>({});

  // Modals
  const [formOpen, setFormOpen] = useState(false);
  const [editContact, setEditContact] = useState<Contact | null>(null);
  const [editContactTags, setEditContactTags] = useState<ContactTag[]>([]);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailContactId, setDetailContactId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Contact | null>(null);
  const [deleting, setDeleting] = useState(false);

  // All tags for display
  const [tagsMap, setTagsMap] = useState<Record<string, Tag>>({});

  const fetchTags = useCallback(async () => {
    const { data } = await supabase.from('tags').select('*');
    if (data) {
      const map: Record<string, Tag> = {};
      data.forEach((t) => (map[t.id] = t));
      setTagsMap(map);
    }
  }, [supabase]);

  // Fetch custom text fields so we can include them in search
  const fetchCustomTextFields = useCallback(async () => {
    const { data } = await supabase
      .from('custom_fields')
      .select('id, field_name, field_type, applies_to')
      .eq('applies_to', 'contact')
      .in('field_type', ['text', 'number']);
    if (data) setCustomTextFields(data as CustomField[]);
  }, [supabase]);

  // Fetch top-2 contact custom fields by sort_order — shown inline in table rows
  const fetchDisplayCustomFields = useCallback(async () => {
    const { data } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('applies_to', 'contact')
      .order('sort_order')
      .limit(2);
    if (data) setDisplayCustomFields(data as CustomField[]);
  }, [supabase]);

  // Fetch filterable custom fields (select, multi_select, file)
  const fetchFilterFields = useCallback(async () => {
    const { data } = await supabase
      .from('custom_fields')
      .select('*')
      .eq('applies_to', 'contact')
      .in('field_type', ['select', 'multi_select', 'file'])
      .order('sort_order');
    if (data) setFilterFields(data as CustomField[]);
  }, [supabase]);

  // Fetch reminder counts across ALL contacts (not just current page)
  const fetchReminderCounts = useCallback(async () => {
    const now = new Date().toISOString();
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayEndISO = todayEnd.toISOString();

    // Fetch deal contact IDs for each bucket first, then count distinct contacts
    const [allRes, todayDeals, missedDeals, upcomingDeals] = await Promise.all([
      supabase.from('contacts').select('id', { count: 'exact', head: true }),
      supabase.from('deals').select('contact_id').eq('status', 'open').not('contact_id', 'is', null)
        .gte('reminder_at', now).lte('reminder_at', todayEndISO),
      supabase.from('deals').select('contact_id').eq('status', 'open').not('contact_id', 'is', null)
        .lt('reminder_at', now),
      supabase.from('deals').select('contact_id').eq('status', 'open').not('contact_id', 'is', null)
        .gt('reminder_at', todayEndISO),
    ]);

    const uniq = (rows: { contact_id: string | null }[]) =>
      new Set(rows.map((r) => r.contact_id).filter(Boolean)).size;

    const todayCount = uniq(todayDeals.data ?? []);
    const missedCount = uniq(missedDeals.data ?? []);
    setReminderCounts({
      today_missed: todayCount + missedCount,
      all: allRes.count ?? 0,
      today: todayCount,
      missed: missedCount,
      upcoming: uniq(upcomingDeals.data ?? []),
    });
  }, [supabase]);

  const fetchContacts = useCallback(async () => {
    setLoading(true);

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    const now = new Date().toISOString();
    const todayEnd = new Date(); todayEnd.setHours(23, 59, 59, 999);
    const todayEndISO = todayEnd.toISOString();

    let query = supabase
      .from('contacts')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(from, to);

    // Reminder tab filter — scope to contacts with matching open deal reminders
    if (reminderTab !== 'all') {
      let dealQuery = supabase.from('deals').select('contact_id').eq('status', 'open').not('contact_id', 'is', null);
      if (reminderTab === 'today_missed') dealQuery = dealQuery.lte('reminder_at', todayEndISO);
      else if (reminderTab === 'today')    dealQuery = dealQuery.gte('reminder_at', now).lte('reminder_at', todayEndISO);
      else if (reminderTab === 'missed')   dealQuery = dealQuery.lt('reminder_at', now);
      else if (reminderTab === 'upcoming') dealQuery = dealQuery.gt('reminder_at', todayEndISO);
      const { data: dealRows } = await dealQuery;
      const contactIds = [...new Set((dealRows ?? []).map((r) => r.contact_id).filter(Boolean) as string[])];
      if (contactIds.length === 0) {
        setContacts([]);
        setTotalCount(0);
        setLoading(false);
        return;
      }
      query = query.in('id', contactIds);
    }

    if (search.trim()) {
      const term = `%${search.trim()}%`;
      const parts = [
        `name.ilike.${term}`,
        `phone.ilike.${term}`,
        `email.ilike.${term}`,
        ...customTextFields.map((f) => `custom_data->>${f.id}.ilike.${term}`),
      ];
      query = query.or(parts.join(','));
    }

    // Assignee multi-select filter (server-side)
    if (assigneeFilter.length > 0) {
      query = query.in('assigned_to', assigneeFilter);
    }

    // Apply custom field filters
    for (const f of filterFields) {
      const selected = activeFilters[f.id];
      if (!selected || selected.length === 0) continue;
      if (f.field_type === 'file') {
        if (selected[0] === 'available') {
          query = query.not(`custom_data->>${f.id}`, 'is', null);
        } else if (selected[0] === 'unavailable') {
          query = query.is(`custom_data->>${f.id}`, null);
        }
      } else if (f.field_type === 'select') {
        const orParts = selected.map((v) => `custom_data->>${f.id}.eq.${v}`);
        query = query.or(orParts.join(','));
      } else if (f.field_type === 'multi_select') {
        // JSONB array contains each selected value (AND semantics — useful for multi-select)
        for (const v of selected) {
          query = query.filter(`custom_data->${f.id}`, 'cs', `["${v}"]`);
        }
      }
    }

    const { data, count, error } = await query;

    if (error) {
      toast.error('Failed to load contacts');
      setLoading(false);
      return;
    }

    setTotalCount(count ?? 0);

    if (!data || data.length === 0) {
      setContacts([]);
      setLoading(false);
      return;
    }

    // Fetch tags for these contacts
    const contactIds = data.map((c) => c.id);
    const { data: contactTags } = await supabase
      .from('contact_tags')
      .select('contact_id, tag_id')
      .in('contact_id', contactIds);

    const tagsByContact: Record<string, string[]> = {};
    contactTags?.forEach((ct) => {
      if (!tagsByContact[ct.contact_id]) tagsByContact[ct.contact_id] = [];
      tagsByContact[ct.contact_id].push(ct.tag_id);
    });

    // Batch-load assignee profiles for this page
    const assignedToIds = [...new Set(data.map((c) => c.assigned_to).filter(Boolean) as string[])];
    const profilesData = assignedToIds.length > 0
      ? (await supabase.from('profiles').select('id, full_name, email').in('id', assignedToIds)).data
      : [];
    const newAssigneesMap: Record<string, Profile> = {};
    (profilesData ?? []).forEach((p) => (newAssigneesMap[p.id] = p as Profile));
    setAssigneesMap(newAssigneesMap);

    const enriched: ContactWithTags[] = data.map((c) => ({
      ...c,
      tags: (tagsByContact[c.id] ?? [])
        .map((tid) => tagsMap[tid])
        .filter(Boolean),
    }));

    setContacts(enriched);
    setLoading(false);
  }, [supabase, page, search, tagsMap, reminderTab, customTextFields, filterFields, activeFilters, assigneeFilter]);

  // Load-once-on-mount-ish data fetches. Each setter inside runs
  // inside an async promise completion (Supabase await), not
  // synchronously in the effect body, so the cascade the lint rule
  // warns about doesn't apply here.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchTags();
  }, [fetchTags]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchCustomTextFields();
  }, [fetchCustomTextFields]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFilterFields();
  }, [fetchFilterFields]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDisplayCustomFields();
  }, [fetchDisplayCustomFields]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchReminderCounts();
  }, [fetchReminderCounts]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchContacts();
  }, [fetchContacts]);

  // Load role-scoped assignable profiles for the Assignee filter
  useEffect(() => {
    if (!profile || !showAssigneeFilter) return;
    let cancelled = false;
    (async () => {
      const list = await getAssignableProfiles(
        supabase,
        profile.id,
        profile.role ?? 'executive',
      );
      if (!cancelled) setAssignableProfiles(list);
    })();
    return () => { cancelled = true; };
  }, [profile, showAssigneeFilter, supabase]);

  function toggleAssignee(profileId: string) {
    setAssigneeFilter((prev) =>
      prev.includes(profileId)
        ? prev.filter((id) => id !== profileId)
        : [...prev, profileId]
    );
    setPage(0);
  }

  function openAddForm() {
    setEditContact(null);
    setEditContactTags([]);
    setFormOpen(true);
  }

  async function openEditForm(contact: Contact) {
    const { data } = await supabase
      .from('contact_tags')
      .select('*')
      .eq('contact_id', contact.id);
    setEditContact(contact);
    setEditContactTags(data ?? []);
    setFormOpen(true);
  }

  function openDetail(contactId: string) {
    setDetailContactId(contactId);
    setDetailOpen(true);
  }

  function confirmDelete(contact: Contact) {
    setDeleteTarget(contact);
    setDeleteConfirmOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    const { error } = await supabase
      .from('contacts')
      .delete()
      .eq('id', deleteTarget.id);

    if (error) {
      toast.error('Failed to delete contact');
    } else {
      toast.success('Contact deleted');
      fetchContacts();
    }

    setDeleting(false);
    setDeleteConfirmOpen(false);
    setDeleteTarget(null);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);
  const hasNext = page < totalPages - 1;
  const hasPrev = page > 0;

  const activeFilterCount =
    Object.values(activeFilters).filter((v) => v.length > 0).length +
    (assigneeFilter.length > 0 ? 1 : 0);

  function toggleFilter(fieldId: string, value: string) {
    setActiveFilters((prev) => {
      const current = prev[fieldId] ?? [];
      const field = filterFields.find((f) => f.id === fieldId);
      // file and select are single-value; multi_select allows multiple
      if (field?.field_type === 'multi_select') {
        const next = current.includes(value)
          ? current.filter((v) => v !== value)
          : [...current, value];
        return { ...prev, [fieldId]: next };
      }
      // single-value toggle: selecting same value clears it
      const next = current.includes(value) ? [] : [value];
      return { ...prev, [fieldId]: next };
    });
    setPage(0);
  }

  function clearFilter(fieldId: string) {
    setActiveFilters((prev) => ({ ...prev, [fieldId]: [] }));
    setPage(0);
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Contacts</h1>
          <p className="text-sm text-slate-400 mt-1">
            Manage your contact list. {totalCount > 0 && `${totalCount} total contacts.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => setImportOpen(true)}
            className="border-slate-700 text-slate-300 hover:bg-slate-800"
          >
            <Upload className="size-4" />
            Import
          </Button>
          <Button
            onClick={openAddForm}
            className="bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Plus className="size-4" />
            Add Contact
          </Button>
        </div>
      </div>

      {/* Reminder tabs + search row */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-900 p-0.5">
          {(['today_missed','all','today','missed','upcoming'] as ReminderTab[]).map((t) => {
            const label = t === 'today_missed' ? 'Today+Missed' : t.charAt(0).toUpperCase() + t.slice(1);
            return (
              <button
                key={t}
                type="button"
                onClick={() => { setReminderTab(t); setPage(0); }}
                className={`rounded-md px-3 py-1 text-xs font-medium transition-all cursor-pointer ${
                  reminderTab === t
                    ? 'bg-primary text-primary-foreground shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
                <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                  reminderTab === t ? 'bg-white/20' : 'bg-slate-700 text-slate-400'
                }`}>
                  {reminderCounts[t]}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by name, phone, email or custom fields…"
            className="pl-8 bg-slate-900 border-slate-700 text-white placeholder:text-slate-500"
          />
        </div>

        {(filterFields.length > 0 || (showAssigneeFilter && assignableProfiles.length > 0)) && (
          <Popover>
            <PopoverTrigger
              className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-medium transition-colors cursor-pointer ${
                activeFilterCount > 0
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <SlidersHorizontal className="size-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="rounded-full bg-primary/20 px-1.5 py-0.5 text-[10px] text-primary font-semibold">
                  {activeFilterCount}
                </span>
              )}
            </PopoverTrigger>
            <PopoverContent
              align="end"
              className="w-72 border-slate-700 bg-slate-900 p-3 space-y-3 max-h-[70vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">Filters</p>
                {activeFilterCount > 0 && (
                  <button
                    type="button"
                    onClick={() => { setActiveFilters({}); setAssigneeFilter([]); setPage(0); }}
                    className="text-[10px] text-slate-500 hover:text-slate-300 cursor-pointer"
                  >
                    Clear all
                  </button>
                )}
              </div>

              {/* Assignee filter — Admin/Owner/Manager only */}
              {showAssigneeFilter && assignableProfiles.length > 0 && (
                <div className="space-y-1.5 pb-2 border-b border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                      Assignee
                    </p>
                    {assigneeFilter.length > 0 && (
                      <button
                        type="button"
                        onClick={() => { setAssigneeFilter([]); setPage(0); }}
                        className="text-[10px] text-slate-600 hover:text-slate-400 cursor-pointer flex items-center gap-0.5"
                      >
                        <X className="size-2.5" /> Clear
                      </button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {assignableProfiles.map((p) => {
                      const selected = assigneeFilter.includes(p.id);
                      const label = p.full_name || p.email;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => toggleAssignee(p.id)}
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                            selected
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                          }`}
                        >
                          <span className="inline-flex size-3.5 items-center justify-center rounded-full bg-black/20 text-[9px] font-bold">
                            {label.charAt(0).toUpperCase()}
                          </span>
                          {label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {filterFields.map((f) => {
                const selected = activeFilters[f.id] ?? [];
                return (
                  <div key={f.id} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <p className="text-[11px] font-medium text-slate-400">{f.field_name}</p>
                      {selected.length > 0 && (
                        <button
                          type="button"
                          onClick={() => clearFilter(f.id)}
                          className="text-[10px] text-slate-600 hover:text-slate-400 cursor-pointer flex items-center gap-0.5"
                        >
                          <X className="size-2.5" /> Clear
                        </button>
                      )}
                    </div>
                    {f.field_type === 'file' ? (
                      <div className="flex gap-1.5">
                        {(['available', 'unavailable'] as const).map((v) => (
                          <button
                            key={v}
                            type="button"
                            onClick={() => toggleFilter(f.id, v)}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                              selected.includes(v)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                          >
                            {v === 'available' ? 'Available' : 'Not Available'}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {((f.field_options?.options ?? []) as string[]).map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() => toggleFilter(f.id, opt)}
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium cursor-pointer transition-all ${
                              selected.includes(opt)
                                ? 'bg-primary text-primary-foreground'
                                : 'bg-slate-700 text-slate-400 hover:bg-slate-600'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Active filter chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap gap-1.5 -mt-3">
          {assigneeFilter.map((id) => {
            const p = assignableProfiles.find((x) => x.id === id);
            const label = p?.full_name || p?.email || 'Unknown';
            return (
              <span
                key={`assignee-${id}`}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] text-primary"
              >
                Assignee: {label}
                <button
                  type="button"
                  onClick={() => toggleAssignee(id)}
                  className="hover:text-primary/70 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          {filterFields.map((f) => {
            const selected = activeFilters[f.id] ?? [];
            if (selected.length === 0) return null;
            return selected.map((v) => (
              <span
                key={`${f.id}-${v}`}
                className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-2.5 py-0.5 text-[11px] text-primary"
              >
                {f.field_name}: {v === 'available' ? 'Available' : v === 'unavailable' ? 'Not Available' : v}
                <button
                  type="button"
                  onClick={() => toggleFilter(f.id, v)}
                  className="hover:text-primary/70 cursor-pointer"
                >
                  <X className="size-3" />
                </button>
              </span>
            ));
          })}
        </div>
      )}

      {/* Table */}
      <div className="rounded-lg border border-slate-800 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="border-slate-800 hover:bg-transparent">
              <TableHead className="text-slate-400">Name</TableHead>
              <TableHead className="text-slate-400">Phone</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">Email</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Company</TableHead>
              <TableHead className="text-slate-400 hidden md:table-cell">Tags</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Assigned</TableHead>
              <TableHead className="text-slate-400 hidden lg:table-cell">Created</TableHead>
              <TableHead className="text-slate-400 w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="size-6 animate-spin text-primary" />
                    <p className="text-sm text-slate-500">Loading contacts...</p>
                  </div>
                </TableCell>
              </TableRow>
            ) : contacts.length === 0 ? (
              <TableRow className="border-slate-800">
                <TableCell colSpan={8} className="text-center py-12">
                  <div className="flex flex-col items-center gap-2">
                    <Users className="size-8 text-slate-600" />
                    <p className="text-sm text-slate-500">
                      {search ? 'No contacts match your search.' : 'No contacts yet.'}
                    </p>
                    {!search && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={openAddForm}
                        className="mt-2 border-slate-700 text-slate-300 hover:bg-slate-800"
                      >
                        <Plus className="size-3.5" />
                        Add your first contact
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              contacts.map((contact) => (
                <TableRow
                  key={contact.id}
                  className="border-slate-800 hover:bg-slate-900/50 cursor-pointer"
                  onClick={() => openDetail(contact.id)}
                >
                  {/* Rich Name cell — name + company (muted) + tag chips + top-2 custom fields */}
                  <TableCell className="py-2.5">
                    <div className="space-y-0.5">
                      <p className="text-white font-semibold text-sm leading-snug">
                        {contact.name || <span className="text-slate-500 italic font-normal">Unnamed</span>}
                      </p>
                      {contact.company && (
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">{contact.company}</p>
                      )}
                      {/* Tag chips (max 2) — visible even at narrow screens where Tags col is hidden */}
                      {contact.tags && contact.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-0.5 md:hidden">
                          {contact.tags.slice(0, 2).map((tag) => (
                            <span
                              key={tag.id}
                              className="inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                              style={{ backgroundColor: tag.color + '20', color: tag.color }}
                            >
                              {tag.name}
                            </span>
                          ))}
                          {contact.tags.length > 2 && (
                            <span className="text-[10px] text-slate-500 self-center">+{contact.tags.length - 2}</span>
                          )}
                        </div>
                      )}
                      {/* Top-2 custom field values */}
                      {displayCustomFields.map((field) => {
                        const raw = (contact.custom_data ?? {})[field.id];
                        if (raw == null || raw === '') return null;
                        const display = Array.isArray(raw) ? (raw as string[]).join(', ') : String(raw);
                        return (
                          <p key={field.id} className="text-[10px] text-slate-500 truncate max-w-[200px]">
                            {field.field_name}: <span className="text-slate-400">{display}</span>
                          </p>
                        );
                      })}
                    </div>
                  </TableCell>
                  <TableCell className="text-slate-300 font-mono text-xs">
                    {contact.phone}
                  </TableCell>
                  <TableCell className="text-slate-400 hidden md:table-cell text-sm">
                    {contact.email || <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="text-slate-400 hidden lg:table-cell text-sm">
                    {contact.company || <span className="text-slate-600">-</span>}
                  </TableCell>
                  <TableCell className="hidden md:table-cell">
                    <div className="flex flex-wrap gap-1">
                      {contact.tags && contact.tags.length > 0 ? (
                        contact.tags.slice(0, 3).map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium"
                            style={{
                              backgroundColor: tag.color + '20',
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))
                      ) : (
                        <span className="text-slate-600 text-xs">-</span>
                      )}
                      {contact.tags && contact.tags.length > 3 && (
                        <span className="text-[10px] text-slate-500">
                          +{contact.tags.length - 3}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  {/* Assigned column */}
                  <TableCell className="hidden lg:table-cell">
                    {contact.assigned_to && assigneesMap[contact.assigned_to] ? (
                      <div className="flex items-center gap-1.5">
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                          {(assigneesMap[contact.assigned_to].full_name || assigneesMap[contact.assigned_to].email || '?').charAt(0).toUpperCase()}
                        </span>
                        <span className="text-xs text-slate-300 truncate max-w-[100px]">
                          {assigneesMap[contact.assigned_to].full_name || assigneesMap[contact.assigned_to].email}
                        </span>
                      </div>
                    ) : (
                      <span className="text-slate-600 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-slate-500 text-xs hidden lg:table-cell">
                    {new Date(contact.created_at).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger
                        render={
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-400 hover:text-white"
                            onClick={(e) => e.stopPropagation()}
                          />
                        }
                      >
                        <MoreHorizontal className="size-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="end"
                        className="bg-slate-900 border-slate-700"
                      >
                        <DropdownMenuItem
                          onClick={(e) => {
                            e.stopPropagation();
                            openEditForm(contact);
                          }}
                          className="text-slate-300 focus:bg-slate-800 focus:text-white"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-slate-700" />
                        <DropdownMenuItem
                          variant="destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            confirmDelete(contact);
                          }}
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Showing {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, totalCount)} of{' '}
            {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasPrev}
              onClick={() => setPage((p) => p - 1)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft className="size-4" />
            </Button>
            <span className="text-xs text-slate-400 px-2">
              Page {page + 1} of {totalPages}
            </span>
            <Button
              variant="outline"
              size="icon-sm"
              disabled={!hasNext}
              onClick={() => setPage((p) => p + 1)}
              className="border-slate-700 text-slate-400 hover:bg-slate-800 hover:text-white disabled:opacity-30"
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Contact Form Dialog */}
      <ContactForm
        open={formOpen}
        onOpenChange={setFormOpen}
        contact={editContact}
        contactTags={editContactTags}
        onSaved={() => {
          fetchContacts();
          fetchTags();
        }}
      />

      {/* Contact Detail Sheet */}
      <ContactDetailView
        open={detailOpen}
        onOpenChange={setDetailOpen}
        contactId={detailContactId}
        onUpdated={fetchContacts}
      />

      {/* Import Modal */}
      <ImportModal
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={fetchContacts}
      />

      {/* Delete Confirmation */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Contact</DialogTitle>
            <DialogDescription className="text-slate-400">
              Are you sure you want to delete{' '}
              <span className="text-slate-200 font-medium">
                {deleteTarget?.name || deleteTarget?.phone}
              </span>
              ? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="bg-slate-900 border-slate-700">
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
