"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Deal, PipelineStage, CustomField, Profile, Tag } from "@/types";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Check,
  X,
  Loader2,
  Bell,
  Trash2,
  Calendar,
  DollarSign,
  User,
  Building2,
  StickyNote,
  Tag as TagIcon,
} from "lucide-react";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import { useAuth } from "@/hooks/use-auth";
import { ActivityHistory } from "@/components/shared/activity-history";
import { ContactInfoCard } from "@/components/shared/contact-info-card";
import { QuickFollowup } from "@/components/shared/quick-followup";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { DealReminderSection } from "./deal-reminder-section";
import { MarkLostDialog } from "./mark-lost-dialog";
import { ComposeEmailDialog } from "@/components/email/compose-dialog";
import { reminderStatus } from "@/lib/deals/reminder-status";
import { Mail, Package, Plus, Trash2 as TrashIcon, FileText as FileTextIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import type { CatalogItem, DealCatalogItem } from "@/types";

// ── Deal Products Tab ─────────────────────────────────────────
function DealProductsTab({ dealId }: { dealId: string }) {
  const supabase = createClient();
  const [items, setItems] = useState<DealCatalogItem[]>([]);
  const [catalog, setCatalog] = useState<CatalogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [{ data: dealItems }, { data: catItems }] = await Promise.all([
        supabase.from('deal_catalog_items').select('*').eq('deal_id', dealId).order('created_at'),
        supabase.from('catalog_items').select('*').eq('is_active', true).order('name'),
      ]);
      if (alive) {
        setItems((dealItems ?? []) as DealCatalogItem[]);
        setCatalog((catItems ?? []) as CatalogItem[]);
        setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [dealId, supabase]);

  async function addItem(cat: CatalogItem) {
    setAdding(true);
    const { data, error } = await supabase.from('deal_catalog_items').insert({
      deal_id: dealId,
      catalog_item_id: cat.id,
      name: cat.name,
      quantity: 1,
    }).select().single();
    if (!error && data) setItems(prev => [...prev, data as DealCatalogItem]);
    setAdding(false);
    setPickerOpen(false);
  }

  async function removeItem(id: string) {
    await supabase.from('deal_catalog_items').delete().eq('id', id);
    setItems(prev => prev.filter(i => i.id !== id));
  }

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Interested Products</p>
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          disabled={adding}
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
        >
          <Plus className="h-3.5 w-3.5" /> Add
        </button>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center py-6 text-center">
          <Package className="h-8 w-8 text-slate-700 mb-2" />
          <p className="text-xs text-slate-500">No products added yet.</p>
          <button type="button" onClick={() => setPickerOpen(true)} className="mt-2 text-xs text-primary hover:underline">
            + Add product
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2">
              <p className="text-sm text-slate-200 truncate">{item.name}</p>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="text-xs text-slate-400">×{item.quantity}</span>
                <button type="button" onClick={() => removeItem(item.id)} className="text-slate-600 hover:text-red-400 transition-colors">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Inline catalog picker popover */}
      {pickerOpen && (
        <div className="rounded-lg border border-slate-700 bg-slate-900 p-3 space-y-2">
          <p className="text-xs font-semibold text-slate-400">Pick a product</p>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {catalog.filter(c => !items.some(i => i.catalog_item_id === c.id)).map(cat => (
              <button
                key={cat.id}
                type="button"
                onClick={() => addItem(cat)}
                disabled={adding}
                className="w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left hover:bg-slate-800 transition-colors"
              >
                <span className="text-sm text-slate-200 truncate">{cat.name}</span>
                <span className="text-xs text-slate-500 shrink-0 ml-2">
                  {new Intl.NumberFormat('en-US', { style: 'currency', currency: cat.currency, minimumFractionDigits: 0 }).format(cat.price)}
                </span>
              </button>
            ))}
            {catalog.filter(c => !items.some(i => i.catalog_item_id === c.id)).length === 0 && (
              <p className="text-xs text-slate-500 text-center py-2">All catalog items already added.</p>
            )}
          </div>
          <button type="button" onClick={() => setPickerOpen(false)} className="text-xs text-slate-500 hover:text-slate-300">Cancel</button>
        </div>
      )}
    </div>
  );
}

interface DealDetailViewProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dealId: string | null;
  stages: PipelineStage[];
  onSaved: () => void;
  onDeleted: () => void;
}

function formatCurrency(value: number, currency?: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatDate(dateStr?: string) {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Render a custom field value read-only (for info cards). */
function renderCustomValue(field: CustomField, raw: unknown): React.ReactNode {
  if (raw == null || raw === "") return <span className="text-slate-600">—</span>;
  if (field.field_type === "multi_select") {
    const arr = Array.isArray(raw) ? (raw as string[]) : [String(raw)];
    return <span className="text-slate-200">{arr.join(", ")}</span>;
  }
  if (field.field_type === "file") {
    return (
      <a
        href={String(raw)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline truncate block max-w-[120px]"
      >
        View file ↗
      </a>
    );
  }
  return <span className="text-slate-200">{String(raw)}</span>;
}

export function DealDetailView({
  open,
  onOpenChange,
  dealId,
  stages,
  onSaved,
  onDeleted,
}: DealDetailViewProps) {
  const supabase = createClient();
  const { profile } = useAuth();
  const router = useRouter();

  // ─── Loaded data ───────────────────────────────────────────────────────────
  const [deal, setDeal] = useState<Deal | null>(null);
  const [dealCustomFields, setDealCustomFields] = useState<CustomField[]>([]);
  const [contactCustomFields, setContactCustomFields] = useState<CustomField[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  // ─── UI state ──────────────────────────────────────────────────────────────
  const [statusActing, setStatusActing] = useState<"won" | "lost" | "open" | null>(null);
  const [markLostOpen, setMarkLostOpen] = useState(false);
  const [emailComposeOpen, setEmailComposeOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ─── Accordion state (Followup tab) ────────────────────────────────────────
  const [followupOpen, setFollowupOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);

  // ─── Summary data for collapsed section headers ────────────────────────────
  const [lastFollowup, setLastFollowup] = useState<{ channel: string; created_at: string } | null>(null);
  const [lastNote, setLastNote] = useState<{ note_text: string; created_at: string } | null>(null);
  const [allTags, setAllTags] = useState<Tag[]>([]);
  const [contactTagIds, setContactTagIds] = useState<string[]>([]);

  // ─── Followup-tab: note adding ─────────────────────────────────────────────
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [savingTags, setSavingTags] = useState(false);

  // ─── Update-tab form state ─────────────────────────────────────────────────
  const [formTitle, setFormTitle] = useState("");
  const [formValue, setFormValue] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");
  const [formStageId, setFormStageId] = useState("");
  const [formAssignedTo, setFormAssignedTo] = useState("");
  const [formCloseDate, setFormCloseDate] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formDealCustomData, setFormDealCustomData] = useState<Record<string, unknown>>({});
  const [formContactName, setFormContactName] = useState("");
  const [formContactPhone, setFormContactPhone] = useState("");
  const [formContactEmail, setFormContactEmail] = useState("");
  const [formContactCompany, setFormContactCompany] = useState("");
  const [formContactCustomData, setFormContactCustomData] = useState<Record<string, unknown>>({});

  // ─── Fetch all data ─────────────────────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!dealId) return;
    setLoading(true);

    const [dealRes, dealFieldsRes, contactFieldsRes, profilesRes, tagsRes, lastFollowupRes] =
      await Promise.all([
        supabase
          .from("deals")
          .select(
            "*, contact:contacts(*, contact_tags(tag:tags(*)), source:sources(id, name, key)), assignee:profiles!deals_assigned_to_fkey(id, full_name, email), closer:profiles!deals_closed_by_fkey(id, full_name, email), stage:pipeline_stages(*), source:sources(id, name, key), lost_reason:lost_reasons(id, reason)"
          )
          .eq("id", dealId)
          .single(),
        supabase
          .from("custom_fields")
          .select("*")
          .eq("applies_to", "deal")
          .order("sort_order"),
        supabase
          .from("custom_fields")
          .select("*")
          .eq("applies_to", "contact")
          .order("sort_order"),
        supabase
          .from("profiles")
          .select("id, full_name, email")
          .eq("is_active", true)
          .order("full_name"),
        supabase.from("tags").select("*").order("name"),
        supabase
          .from("followups")
          .select("channel, created_at")
          .eq("deal_id", dealId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

    const loadedDeal = (dealRes.data as Deal) ?? null;
    setDeal(loadedDeal);
    setDealCustomFields((dealFieldsRes.data as CustomField[]) ?? []);
    setContactCustomFields((contactFieldsRes.data as CustomField[]) ?? []);
    setProfiles((profilesRes.data as Profile[]) ?? []);
    setAllTags((tagsRes.data as Tag[]) ?? []);
    setLastFollowup(
      lastFollowupRes.data
        ? { channel: lastFollowupRes.data.channel, created_at: lastFollowupRes.data.created_at }
        : null
    );

    // Second phase: contact-specific data (needs contact_id from deal)
    if (loadedDeal?.contact_id) {
      const [contactTagsRes, lastNoteRes] = await Promise.all([
        supabase
          .from("contact_tags")
          .select("tag_id")
          .eq("contact_id", loadedDeal.contact_id),
        supabase
          .from("contact_notes")
          .select("note_text, created_at")
          .eq("contact_id", loadedDeal.contact_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      setContactTagIds(
        ((contactTagsRes.data ?? []) as { tag_id: string }[]).map((ct) => ct.tag_id)
      );
      setLastNote(
        lastNoteRes.data
          ? { note_text: lastNoteRes.data.note_text, created_at: lastNoteRes.data.created_at }
          : null
      );
    } else {
      setContactTagIds([]);
      setLastNote(null);
    }

    setLoading(false);
  }, [dealId, supabase]);

  useEffect(() => {
    if (open && dealId) {
      // Resetting accordion + delete-confirm + draft note on every
      // open is intentional UI sync, not external state — the lint
      // rule's "external systems" guidance doesn't apply.
      /* eslint-disable react-hooks/set-state-in-effect */
      setFollowupOpen(false);
      setReminderOpen(false);
      setNoteOpen(false);
      setTagsOpen(false);
      setNewNote("");
      setConfirmDelete(false);
      /* eslint-enable react-hooks/set-state-in-effect */
      fetchAll();
    }
  }, [open, dealId, fetchAll]);

  // Sync update-tab form when deal loads
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!deal) return;
    setFormTitle(deal.title);
    setFormValue(String(deal.value ?? ""));
    setFormCurrency(deal.currency || "USD");
    setFormStageId(deal.stage_id);
    setFormAssignedTo(deal.assigned_to ?? "");
    setFormCloseDate(deal.expected_close_date ?? "");
    setFormNotes(deal.notes ?? "");
    setFormDealCustomData((deal.custom_data ?? {}) as Record<string, unknown>);
    if (deal.contact) {
      setFormContactName(deal.contact.name ?? "");
      setFormContactPhone(deal.contact.phone ?? "");
      setFormContactEmail(deal.contact.email ?? "");
      setFormContactCompany(deal.contact.company ?? "");
      setFormContactCustomData(
        (deal.contact.custom_data ?? {}) as Record<string, unknown>
      );
    }
  }, [deal]);
  /* eslint-enable react-hooks/set-state-in-effect */

  // ─── Actions ────────────────────────────────────────────────────────────────
  async function handleStatusChange(status: "won" | "lost" | "open") {
    if (!deal) return;
    // "lost" requires a reason — open the dialog instead of direct update
    if (status === "lost") {
      setMarkLostOpen(true);
      return;
    }
    setStatusActing(status);
    const payload: Record<string, unknown> = { status };
    if (status === "won") payload.closed_by = profile?.id ?? null;
    const { error } = await supabase
      .from("deals")
      .update(payload)
      .eq("id", deal.id);
    setStatusActing(null);
    if (error) {
      toast.error("Failed to update deal status");
      return;
    }
    toast.success(status === "won" ? "Marked as won 🎉" : "Deal reopened");
    fetchAll();
    onSaved();
  }

  /** Called by MarkLostDialog when the user confirms a reason */
  async function handleConfirmLost(reasonId: string) {
    if (!deal) return;
    const { error } = await supabase
      .from("deals")
      .update({ status: "lost", lost_reason_id: reasonId, closed_by: profile?.id ?? null })
      .eq("id", deal.id);
    if (error) throw new Error(error.message);
    toast.success("Marked as lost");
    fetchAll();
    onSaved();
  }

  async function saveAll() {
    if (!deal || !formTitle.trim()) {
      toast.error("Title is required");
      return;
    }
    setSaving(true);

    const { error: dealError } = await supabase
      .from("deals")
      .update({
        title: formTitle.trim(),
        value: parseFloat(formValue) || 0,
        currency: formCurrency,
        stage_id: formStageId,
        assigned_to: formAssignedTo || null,
        expected_close_date: formCloseDate || null,
        notes: formNotes.trim() || null,
        // source_id intentionally omitted — immutable after creation (DB trigger 017)
        custom_data: formDealCustomData,
      })
      .eq("id", deal.id);

    if (dealError) {
      toast.error("Failed to save deal");
      setSaving(false);
      return;
    }

    if (deal.contact_id) {
      const { error: contactError } = await supabase
        .from("contacts")
        .update({
          name: formContactName.trim() || null,
          phone: formContactPhone.trim(),
          email: formContactEmail.trim() || null,
          company: formContactCompany.trim() || null,
          custom_data: formContactCustomData,
        })
        .eq("id", deal.contact_id);
      if (contactError) {
        toast.error("Deal saved but contact update failed");
      }
    }

    setSaving(false);
    toast.success("Changes saved");
    fetchAll();
    onSaved();
  }

  async function handleDelete() {
    if (!deal) return;
    setDeleting(true);
    const { error } = await supabase.from("deals").delete().eq("id", deal.id);
    setDeleting(false);
    if (error) {
      toast.error("Failed to delete deal");
      return;
    }
    toast.success("Deal deleted");
    onOpenChange(false);
    onDeleted();
  }

  async function toggleTag(tagId: string) {
    if (!deal?.contact_id) return;
    setSavingTags(true);
    const isSelected = contactTagIds.includes(tagId);
    if (isSelected) {
      const { error } = await supabase
        .from("contact_tags")
        .delete()
        .eq("contact_id", deal.contact_id)
        .eq("tag_id", tagId);
      if (!error) setContactTagIds((prev) => prev.filter((id) => id !== tagId));
    } else {
      const { error } = await supabase
        .from("contact_tags")
        .insert({ contact_id: deal.contact_id, tag_id: tagId });
      if (!error) setContactTagIds((prev) => [...prev, tagId]);
    }
    setSavingTags(false);
    onSaved();
  }

  async function addNote() {
    if (!deal?.contact_id || !newNote.trim()) return;
    setSavingNote(true);
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) {
      toast.error("Not authenticated");
      setSavingNote(false);
      return;
    }
    const { error } = await supabase.from("contact_notes").insert({
      contact_id: deal.contact_id,
      user_id: user.id,
      note_text: newNote.trim(),
    });
    if (error) {
      toast.error("Failed to add note");
    } else {
      toast.success("Note added");
      setNewNote("");
      setNoteOpen(false);
      fetchAll();
    }
    setSavingNote(false);
  }

  // ─── Derived ────────────────────────────────────────────────────────────────
  const contactWithTags = deal?.contact
    ? {
        ...deal.contact,
        tags: (
          (deal.contact as unknown as { contact_tags?: Array<{ tag: Tag }> })
            .contact_tags ?? []
        )
          .map((ct) => ct.tag)
          .filter(Boolean) as Tag[],
      }
    : null;

  const reminderBadge = deal?.status === "open"
    ? reminderStatus(deal.reminder_at)
    : null;

  const currentStage = stages.find((s) => s.id === deal?.stage_id);

  /** Collapsed summary for the Followup accordion row */
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

  /** Collapsed summary for the Reminder accordion row */
  const reminderSummary = deal?.reminder_at ? (
    <span className="flex items-center gap-1.5 flex-wrap">
      <span className="text-slate-400 capitalize">{deal.reminder_type ?? "Reminder"}</span>
      <span className="text-slate-500 text-[10px]">·</span>
      <span className="text-slate-500 text-[10px]">{formatDate(deal.reminder_at)}</span>
      {reminderBadge && (
        <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${reminderBadge.cls}`}>
          {reminderBadge.label}
        </span>
      )}
    </span>
  ) : (
    <span className="text-slate-600">No reminder set</span>
  );

  /** Collapsed summary for the Note accordion row */
  const noteSummary = lastNote ? (
    <span className="flex items-center gap-1.5">
      <span className="text-slate-400 truncate max-w-[160px]">
        &ldquo;{lastNote.note_text.slice(0, 45)}{lastNote.note_text.length > 45 ? "…" : ""}&rdquo;
      </span>
      <span className="text-slate-500 shrink-0">{timeAgo(lastNote.created_at)}</span>
    </span>
  ) : (
    <span className="text-slate-600">No notes yet</span>
  );

  /** Collapsed summary for the Tags accordion row */
  const activeTags = allTags.filter((t) => contactTagIds.includes(t.id));
  const tagsSummary = activeTags.length > 0 ? (
    <span className="flex items-center gap-1 flex-wrap">
      {activeTags.slice(0, 3).map((t) => (
        <span
          key={t.id}
          className="inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium"
          style={{ backgroundColor: t.color + "20", color: t.color }}
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

  // ─── Custom field input helpers ─────────────────────────────────────────────
  function setDealField(fieldId: string, val: unknown) {
    setFormDealCustomData((prev) => ({ ...prev, [fieldId]: val }));
  }
  function setContactField(fieldId: string, val: unknown) {
    setFormContactCustomData((prev) => ({ ...prev, [fieldId]: val }));
  }

  function renderFieldInput(
    field: CustomField,
    val: unknown,
    onChange: (v: unknown) => void
  ) {
    const inputClass =
      "h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary focus:ring-1 focus:ring-primary";

    if (field.field_type === "select") {
      const opts = (field.field_options?.options ?? []) as string[];
      return (
        <select
          value={String(val ?? "")}
          onChange={(e) => onChange(e.target.value || null)}
          className={inputClass}
        >
          <option value="">— none —</option>
          {opts.map((o) => (
            <option key={o} value={o}>{o}</option>
          ))}
        </select>
      );
    }

    if (field.field_type === "multi_select") {
      const opts = (field.field_options?.options ?? []) as string[];
      const selected: string[] = Array.isArray(val) ? (val as string[]) : [];
      const toggle = (o: string) => {
        const next = selected.includes(o)
          ? selected.filter((s) => s !== o)
          : [...selected, o];
        onChange(next.length ? next : null);
      };
      return (
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {opts.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-all cursor-pointer ${
                selected.includes(o)
                  ? "bg-primary text-primary-foreground"
                  : "bg-slate-700 text-slate-400 hover:bg-slate-600"
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }

    if (field.field_type === "number") {
      return (
        <Input
          type="number"
          value={val == null ? "" : String(val)}
          onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          className="border-slate-700 bg-slate-800 text-white"
        />
      );
    }

    if (field.field_type === "file") {
      return (
        <div className="space-y-1">
          {val != null && val !== "" && (
            <a
              href={String(val)}
              target="_blank"
              rel="noopener noreferrer"
              className="block text-xs text-primary hover:underline truncate"
            >
              Current file ↗
            </a>
          )}
          <Input
            type="url"
            placeholder="Paste file URL…"
            value={val == null ? "" : String(val)}
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
        value={val == null ? "" : String(val)}
        onChange={(e) => onChange(e.target.value || null)}
        className="border-slate-700 bg-slate-800 text-white"
      />
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        className="bg-slate-900 border-slate-700 text-slate-200 sm:max-w-lg w-full p-0"
      >
        {loading || !deal ? (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="size-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="flex h-full flex-col overflow-hidden">
            {/* ── Header ──────────────────────────────────────────────────── */}
            <SheetHeader className="shrink-0 border-b border-slate-700/50 px-4 py-3">
              <div className="flex items-start gap-2">
                <div className="flex-1 min-w-0">
                  <SheetTitle className="text-white text-base leading-snug break-words">
                    {deal.title}
                  </SheetTitle>
                  <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                    {/* Stage chip */}
                    {currentStage && (
                      <span
                        className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium"
                        style={{
                          backgroundColor: `${currentStage.color}20`,
                          color: currentStage.color,
                        }}
                      >
                        <span
                          className="inline-block h-1.5 w-1.5 rounded-full"
                          style={{ backgroundColor: currentStage.color }}
                        />
                        {currentStage.name}
                      </span>
                    )}
                    {/* Status badge */}
                    {deal.status === "won" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-semibold text-primary">
                        <Check className="h-2.5 w-2.5" /> Won
                      </span>
                    )}
                    {deal.status === "lost" && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-[11px] font-semibold text-red-400">
                        <X className="h-2.5 w-2.5" /> Lost
                      </span>
                    )}
                    {/* Lost reason chip */}
                    {deal.status === "lost" && deal.lost_reason && (
                      <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-[11px] text-red-400">
                        {deal.lost_reason.reason}
                      </span>
                    )}
                  </div>
                </div>
                <button
                  type="button"
                  title="Create Proposal"
                  onClick={async () => {
                    const res = await fetch('/api/proposals', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        title: `Proposal for ${deal.title}`,
                        deal_id: deal.id,
                        contact_id: deal.contact_id,
                        seed_from_deal: true,
                      }),
                    });
                    if (res.ok) {
                      const data = await res.json();
                      router.push(`/proposals/${data.id}`);
                    }
                  }}
                  className="shrink-0 flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium text-primary border border-primary/30 hover:bg-primary/10 transition-colors"
                >
                  <FileTextIcon className="h-3.5 w-3.5" /> Proposal
                </button>
              </div>
            </SheetHeader>

            {/* ── Scrollable body ──────────────────────────────────────────── */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {/* Deal Info Card */}
              <div className="shrink-0 border-b border-slate-700/40 px-4 py-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                  <div>
                    <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
                      <DollarSign className="size-2.5" /> Value
                    </p>
                    <p className="text-xs font-semibold text-primary">
                      {formatCurrency(deal.value, deal.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
                      <Calendar className="size-2.5" /> Close Date
                    </p>
                    <p className="text-xs text-slate-200">
                      {formatDate(deal.expected_close_date)}
                    </p>
                  </div>
                  <div>
                    <p className="flex items-center gap-1 text-[11px] text-slate-500 mb-0.5">
                      <User className="size-2.5" /> Assigned
                    </p>
                    <p className="text-xs text-slate-200">
                      {deal.assignee
                        ? (deal.assignee as Profile).full_name ||
                          (deal.assignee as Profile).email
                        : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-[11px] text-slate-500 mb-0.5">Status</p>
                    <p className="text-xs text-slate-200 capitalize">
                      {deal.status ?? "open"}
                    </p>
                  </div>
                  {deal.source && (
                    <div>
                      <p className="text-[11px] text-slate-500 mb-0.5">Source</p>
                      <span className="inline-flex items-center rounded-full bg-slate-700/60 px-2 py-0.5 text-[10px] font-medium text-slate-200">
                        {deal.source.name}
                      </span>
                    </div>
                  )}
                  {/* Deal custom fields — same grid rhythm */}
                  {dealCustomFields.map((field) => {
                    const raw = (deal.custom_data ?? {})[field.id];
                    return (
                      <div key={field.id}>
                        <p className="text-[11px] text-slate-500 mb-0.5">
                          {field.field_name}
                        </p>
                        <div className="text-xs">{renderCustomValue(field, raw)}</div>
                      </div>
                    );
                  })}
                </div>
                {/* Notes preview */}
                {deal.notes && (
                  <p className="text-xs text-slate-400 line-clamp-2 pt-0.5">
                    {deal.notes}
                  </p>
                )}
              </div>

              {/* Contact Info Card (if contact linked) */}
              {contactWithTags && (
                <div className="shrink-0 border-b border-slate-700/40 px-4 py-3">
                  <p className="mb-2 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    <Building2 className="size-3" />
                    Contact
                  </p>
                  <ContactInfoCard
                    contact={contactWithTags}
                    customFields={contactCustomFields}
                    assignee={null}
                  />
                </div>
              )}

              {/* ── Tabs ──────────────────────────────────────────────────── */}
              <Tabs
                defaultValue="history"
                className="flex flex-1 flex-col overflow-hidden"
              >
                <TabsList className="shrink-0 mx-4 mt-2 grid grid-cols-4 bg-slate-800 border border-slate-700">
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
                  <TabsTrigger
                    value="products"
                    className="data-[state=active]:bg-slate-700 data-[state=active]:text-white text-slate-400 text-xs"
                  >
                    Products
                  </TabsTrigger>
                </TabsList>

                {/* History tab */}
                <TabsContent
                  value="history"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  <ActivityHistory contactId={deal.contact_id} dealId={deal.id} />
                </TabsContent>

                {/* Followup tab */}
                <TabsContent
                  value="followup"
                  className="flex-1 overflow-y-auto px-4 py-3 space-y-2.5"
                >
                  {/* ── Deal Status — always visible, non-collapsible ─── */}
                  <div className="rounded-lg border border-slate-700/60 bg-slate-800/40 px-3 py-2.5 space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      Deal Status
                    </p>
                    {deal.status === "open" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleStatusChange("won")}
                          disabled={!!statusActing}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-primary/30 bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-all hover:bg-primary/20 disabled:opacity-50 cursor-pointer"
                        >
                          {statusActing === "won" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Check className="size-3.5" />
                          )}
                          Mark Won
                        </button>
                        <button
                          type="button"
                          onClick={() => handleStatusChange("lost")}
                          disabled={!!statusActing}
                          className="flex-1 flex items-center justify-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition-all hover:bg-red-500/20 disabled:opacity-50 cursor-pointer"
                        >
                          {statusActing === "lost" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <X className="size-3.5" />
                          )}
                          Mark Lost
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <p className="text-xs text-slate-400">
                          This deal is marked as{" "}
                          <span className={deal.status === "won" ? "text-primary font-semibold" : "text-red-400 font-semibold"}>
                            {deal.status}
                          </span>.
                        </p>
                        {deal.closed_at && (
                          <p className="text-[11px] text-slate-500">
                            Closed {formatDate(deal.closed_at)}
                            {deal.closer && (
                              <> by <span className="text-slate-400">{deal.closer.full_name || deal.closer.email}</span></>
                            )}
                          </p>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange("open")}
                          disabled={!!statusActing}
                          className="w-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800"
                        >
                          {statusActing === "open" && (
                            <Loader2 className="size-3.5 animate-spin" />
                          )}
                          Reopen Deal
                        </Button>
                      </div>
                    )}
                  </div>

                  {/* ── Send Email ──────────────────────────────────── */}
                  {deal.contact?.email && (
                    <button
                      type="button"
                      onClick={() => setEmailComposeOpen(true)}
                      className="flex w-full items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 text-xs font-medium text-slate-300 transition-colors hover:bg-slate-700 hover:text-white cursor-pointer"
                    >
                      <Mail className="size-3.5" />
                      Send Email to {deal.contact.name || deal.contact.email}
                    </button>
                  )}

                  {/* ── Followup — collapsible ─────────────────────── */}
                  <CollapsibleSection
                    title="Followup"
                    summary={followupSummary}
                    open={followupOpen}
                    onToggle={() => setFollowupOpen((p) => !p)}
                  >
                    <QuickFollowup
                      contactId={deal.contact_id}
                      dealId={deal.id}
                      onSaved={() => { fetchAll(); }}
                      showHistory={false}
                      onComposeEmail={deal.contact?.email ? () => setEmailComposeOpen(true) : undefined}
                    />
                  </CollapsibleSection>

                  {/* ── Reminder — collapsible ────────────────────── */}
                  <CollapsibleSection
                    title="Reminder"
                    icon={<Bell className="size-3.5" />}
                    summary={reminderSummary}
                    open={reminderOpen}
                    onToggle={() => setReminderOpen((p) => !p)}
                  >
                    <DealReminderSection
                      deal={deal}
                      onUpdated={() => { fetchAll(); onSaved(); }}
                    />
                  </CollapsibleSection>

                  {/* ── Note — collapsible ─────────────────────────── */}
                  {deal.contact_id && (
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
                            onClick={() => { setNoteOpen(false); setNewNote(""); }}
                            className="text-slate-400 hover:text-white"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </CollapsibleSection>
                  )}

                  {/* ── Tags — collapsible ─────────────────────────── */}
                  {deal.contact_id && allTags.length > 0 && (
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
                                backgroundColor: tag.color + "20",
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
                  {/* ── Deal section ── */}
                  <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500">
                    Deal
                  </p>

                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Title</Label>
                    <Input
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      className="border-slate-700 bg-slate-800 text-white"
                    />
                  </div>

                  <div className="grid grid-cols-[1fr_110px] gap-3">
                    <div className="grid gap-2">
                      <Label className="text-slate-300 text-xs">Value</Label>
                      <div className="relative">
                        <DollarSign className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-500" />
                        <Input
                          type="number"
                          value={formValue}
                          onChange={(e) => setFormValue(e.target.value)}
                          placeholder="0"
                          className="border-slate-700 bg-slate-800 pl-7 text-white"
                        />
                      </div>
                    </div>
                    <div className="grid gap-2">
                      <Label className="text-slate-300 text-xs">Currency</Label>
                      <select
                        value={formCurrency}
                        onChange={(e) => setFormCurrency(e.target.value)}
                        className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                      >
                        <option value="USD">USD</option>
                        <option value="EUR">EUR</option>
                        <option value="GBP">GBP</option>
                        <option value="INR">INR</option>
                        <option value="AED">AED</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Stage</Label>
                    <select
                      value={formStageId}
                      onChange={(e) => setFormStageId(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                    >
                      {stages.map((s) => (
                        <option key={s.id} value={s.id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Expected Close Date</Label>
                    <Input
                      type="date"
                      value={formCloseDate}
                      onChange={(e) => setFormCloseDate(e.target.value)}
                      className="border-slate-700 bg-slate-800 text-white"
                    />
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Assigned To</Label>
                    <select
                      value={formAssignedTo}
                      onChange={(e) => setFormAssignedTo(e.target.value)}
                      className="h-9 w-full rounded-lg border border-slate-700 bg-slate-800 px-2.5 text-sm text-white outline-none focus:border-primary"
                    >
                      <option value="">Unassigned</option>
                      {profiles.map((p) => (
                        <option key={p.id} value={p.id}>{p.full_name || p.email}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <Label className="text-slate-300 text-xs">Notes</Label>
                    <Textarea
                      value={formNotes}
                      onChange={(e) => setFormNotes(e.target.value)}
                      placeholder="Add notes…"
                      className="min-h-[80px] border-slate-700 bg-slate-800 text-white"
                    />
                  </div>

                  {/* Deal custom fields — visually identical to standard fields above */}
                  {dealCustomFields.map((field) => (
                    <div key={field.id} className="grid gap-2">
                      <Label className="text-slate-300 text-xs">{field.field_name}</Label>
                      {renderFieldInput(
                        field,
                        formDealCustomData[field.id],
                        (v) => setDealField(field.id, v)
                      )}
                    </div>
                  ))}

                  {/* ── Contact section ── */}
                  {deal.contact_id && (
                    <>
                      <p className="text-[11px] font-medium uppercase tracking-wider text-slate-500 pt-2">
                        Contact
                      </p>

                      <div className="grid gap-2">
                        <Label className="text-slate-300 text-xs">Name</Label>
                        <Input
                          value={formContactName}
                          onChange={(e) => setFormContactName(e.target.value)}
                          className="border-slate-700 bg-slate-800 text-white"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-slate-300 text-xs">Phone</Label>
                        <Input
                          value={formContactPhone}
                          onChange={(e) => setFormContactPhone(e.target.value)}
                          className="border-slate-700 bg-slate-800 text-white"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-slate-300 text-xs">Email</Label>
                        <Input
                          type="email"
                          value={formContactEmail}
                          onChange={(e) => setFormContactEmail(e.target.value)}
                          className="border-slate-700 bg-slate-800 text-white"
                        />
                      </div>

                      <div className="grid gap-2">
                        <Label className="text-slate-300 text-xs">Company</Label>
                        <Input
                          value={formContactCompany}
                          onChange={(e) => setFormContactCompany(e.target.value)}
                          className="border-slate-700 bg-slate-800 text-white"
                        />
                      </div>

                      {/* Contact custom fields — same styling, no separator */}
                      {contactCustomFields.map((field) => (
                        <div key={field.id} className="grid gap-2">
                          <Label className="text-slate-300 text-xs">{field.field_name}</Label>
                          {renderFieldInput(
                            field,
                            formContactCustomData[field.id],
                            (v) => setContactField(field.id, v)
                          )}
                        </div>
                      ))}
                    </>
                  )}

                  {/* Save button */}
                  <Button
                    onClick={saveAll}
                    disabled={saving || !formTitle.trim()}
                    className="w-full bg-primary text-primary-foreground hover:bg-primary/90 mt-2"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Saving…
                      </>
                    ) : (
                      "Save All"
                    )}
                  </Button>

                  {/* Delete */}
                  {confirmDelete ? (
                    <div className="flex items-center justify-between gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs">
                      <span className="text-red-300">Delete this deal?</span>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(false)}
                          disabled={deleting}
                          className="rounded px-2 py-1 text-slate-300 hover:bg-slate-800 cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleDelete}
                          disabled={deleting}
                          className="rounded bg-red-600 px-2 py-1 font-medium text-white hover:bg-red-700 disabled:opacity-50 cursor-pointer"
                        >
                          {deleting ? "Deleting…" : "Confirm"}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(true)}
                      className="flex w-full items-center justify-center gap-1 text-xs text-red-400 hover:text-red-300 py-1 cursor-pointer"
                    >
                      <Trash2 className="size-3" />
                      Delete Deal
                    </button>
                  )}
                </TabsContent>

                {/* Products tab */}
                <TabsContent
                  value="products"
                  className="flex-1 overflow-y-auto px-4 py-3"
                >
                  <DealProductsTab dealId={deal.id} />
                </TabsContent>
              </Tabs>
            </div>
          </div>
        )}
      </SheetContent>

      {/* Mark Lost dialog — mounted outside SheetContent to avoid z-index stacking issues */}
      <MarkLostDialog
        open={markLostOpen}
        onOpenChange={setMarkLostOpen}
        onConfirm={handleConfirmLost}
      />

      {/* Email compose dialog */}
      {deal && (
        <ComposeEmailDialog
          open={emailComposeOpen}
          onClose={() => setEmailComposeOpen(false)}
          contact={
            deal.contact
              ? { id: deal.contact.id, name: deal.contact.name, email: deal.contact.email }
              : undefined
          }
          deal={{
            id: deal.id,
            title: deal.title,
            value: deal.value,
            currency: deal.currency,
            stageName: deal.stage?.name,
          }}
          onSent={() => fetchAll()}
        />
      )}
    </Sheet>
  );
}
