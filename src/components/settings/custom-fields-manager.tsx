"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { CustomField, CustomFieldType } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, Trash2, Pencil, Loader2, GripVertical } from "lucide-react";
import { toast } from "sonner";

const FIELD_TYPES: { value: CustomFieldType; label: string }[] = [
  { value: "text",         label: "Text" },
  { value: "number",       label: "Number" },
  { value: "select",       label: "Select" },
  { value: "multi_select", label: "Multi-select" },
  { value: "file",         label: "File" },
];

const TYPE_BADGE: Record<CustomFieldType, string> = {
  text:         "bg-slate-700 text-slate-300",
  number:       "bg-blue-500/15 text-blue-400",
  select:       "bg-violet-500/15 text-violet-400",
  multi_select: "bg-indigo-500/15 text-indigo-400",
  file:         "bg-amber-500/15 text-amber-400",
};

interface FieldFormState {
  field_name: string;
  field_type: CustomFieldType;
  applies_to: "contact" | "deal";
  options: string; // comma-separated raw string for select/multi_select
}

const BLANK: FieldFormState = {
  field_name: "",
  field_type: "text",
  applies_to: "contact",
  options: "",
};

export function CustomFieldsManager() {
  const supabase = createClient();

  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(false);

  // Add / edit form
  const [formOpen, setFormOpen] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [form, setForm] = useState<FieldFormState>(BLANK);
  const [saving, setSaving] = useState(false);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<CustomField | null>(null);
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleting, setDeleting] = useState(false);

  const fetchFields = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("custom_fields")
      .select("*")
      .order("sort_order")
      .order("field_name");
    setFields((data ?? []) as CustomField[]);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchFields();
  }, [fetchFields]);

  function openAdd() {
    setEditingField(null);
    setForm(BLANK);
    setFormOpen(true);
  }

  function openEdit(f: CustomField) {
    setEditingField(f);
    setForm({
      field_name: f.field_name,
      field_type: f.field_type,
      applies_to: f.applies_to,
      options: ((f.field_options?.options ?? []) as string[]).join(", "),
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!form.field_name.trim()) {
      toast.error("Field name is required");
      return;
    }
    setSaving(true);

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user;
    if (!user) { toast.error("Not signed in"); setSaving(false); return; }

    const optionsArr = ["select", "multi_select"].includes(form.field_type)
      ? form.options.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

    const payload = {
      field_name:    form.field_name.trim(),
      applies_to:    form.applies_to,
      field_options: optionsArr.length > 0 ? { options: optionsArr } : null,
      sort_order:    editingField?.sort_order ?? fields.length,
    };

    if (editingField) {
      const { error } = await supabase
        .from("custom_fields")
        .update(payload)
        .eq("id", editingField.id);
      if (error) { toast.error("Failed to update field"); setSaving(false); return; }
    } else {
      const { error } = await supabase
        .from("custom_fields")
        .insert({ ...payload, user_id: user.id, field_type: form.field_type });
      if (error) { toast.error("Failed to create field"); setSaving(false); return; }
    }

    toast.success(editingField ? "Field updated" : "Field created");
    setFormOpen(false);
    fetchFields();
    setSaving(false);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    // Deleting the field definition removes it from the UI everywhere.
    // Orphaned keys in custom_data JSONB are invisible since we only
    // render fields that exist in the custom_fields master table.
    const { error } = await supabase
      .from("custom_fields")
      .delete()
      .eq("id", deleteTarget.id);

    if (error) {
      toast.error("Failed to delete field");
    } else {
      toast.success("Field deleted");
      fetchFields();
    }
    setDeleting(false);
    setDeleteTarget(null);
    setDeleteConfirmName("");
  }

  const needsOptions = form.field_type === "select" || form.field_type === "multi_select";

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-slate-300 font-medium">Custom Fields</p>
          <p className="text-xs text-slate-500 mt-0.5">
            Define additional fields for contacts and deals.
          </p>
        </div>
        <Button
          onClick={openAdd}
          size="sm"
          className="bg-primary text-primary-foreground hover:bg-primary/90"
        >
          <Plus className="size-3.5" />
          Add Field
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="size-5 animate-spin text-slate-500" />
        </div>
      ) : fields.length === 0 ? (
        <div className="rounded-lg border border-dashed border-slate-700 py-10 text-center">
          <p className="text-sm text-slate-500">No custom fields yet.</p>
          <button
            type="button"
            onClick={openAdd}
            className="mt-2 text-xs text-primary hover:underline cursor-pointer"
          >
            Add your first field
          </button>
        </div>
      ) : (
        <div className="rounded-lg border border-slate-700 divide-y divide-slate-700/50">
          {fields.map((f) => (
            <div
              key={f.id}
              className="flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800/30 transition-colors"
            >
              <GripVertical className="size-4 text-slate-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-slate-200 font-medium">{f.field_name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${TYPE_BADGE[f.field_type] ?? 'bg-slate-700 text-slate-400'}`}>
                    {FIELD_TYPES.find((t) => t.value === f.field_type)?.label ?? f.field_type}
                  </span>
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] text-slate-500">
                    {f.applies_to}
                  </span>
                </div>
                {f.field_options?.options && (f.field_options.options as string[]).length > 0 && (
                  <p className="text-xs text-slate-500 mt-0.5 truncate">
                    Options: {(f.field_options.options as string[]).join(", ")}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => openEdit(f)}
                className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
              >
                <Pencil className="size-3.5" />
              </button>
              <button
                type="button"
                onClick={() => { setDeleteTarget(f); setDeleteConfirmName(""); }}
                className="text-slate-500 hover:text-red-400 transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">
              {editingField ? "Edit Field" : "New Custom Field"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Field Name</Label>
              <Input
                value={form.field_name}
                onChange={(e) => setForm((p) => ({ ...p, field_name: e.target.value }))}
                placeholder="e.g. Company Size"
                className="bg-slate-800 border-slate-700 text-white"
              />
            </div>
            {!editingField && (
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Type</Label>
                <div className="flex flex-wrap gap-1.5">
                  {FIELD_TYPES.map((t) => (
                    <button
                      key={t.value}
                      type="button"
                      onClick={() => setForm((p) => ({ ...p, field_type: t.value }))}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-medium cursor-pointer transition-all ${
                        form.field_type === t.value
                          ? "bg-primary text-primary-foreground"
                          : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-xs">Applies To</Label>
              <div className="flex gap-2">
                {(["contact", "deal"] as const).map((a) => (
                  <button
                    key={a}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, applies_to: a }))}
                    className={`rounded-full px-3 py-0.5 text-xs font-medium cursor-pointer capitalize transition-all ${
                      form.applies_to === a
                        ? "bg-primary text-primary-foreground"
                        : "bg-slate-700 text-slate-400 hover:bg-slate-600"
                    }`}
                  >
                    {a}
                  </button>
                ))}
              </div>
            </div>
            {needsOptions && (
              <div className="space-y-1.5">
                <Label className="text-slate-300 text-xs">Options (comma-separated)</Label>
                <Input
                  value={form.options}
                  onChange={(e) => setForm((p) => ({ ...p, options: e.target.value }))}
                  placeholder="Option 1, Option 2, Option 3"
                  className="bg-slate-800 border-slate-700 text-white"
                />
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setFormOpen(false)}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !form.field_name.trim()}
              className="bg-primary text-primary-foreground hover:bg-primary/90"
            >
              {saving && <Loader2 className="size-3.5 animate-spin" />}
              {editingField ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(o) => { if (!o) { setDeleteTarget(null); setDeleteConfirmName(""); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-white">Delete Custom Field</DialogTitle>
            <DialogDescription className="text-slate-400 text-sm">
              Deleting <span className="font-semibold text-slate-200">{deleteTarget?.field_name}</span> will permanently remove all stored data for this field across all records. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5 py-1">
            <Label className="text-slate-400 text-xs">
              Type <span className="font-mono text-slate-200">{deleteTarget?.field_name}</span> to confirm
            </Label>
            <Input
              value={deleteConfirmName}
              onChange={(e) => setDeleteConfirmName(e.target.value)}
              placeholder={deleteTarget?.field_name}
              className="bg-slate-800 border-slate-700 text-white"
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteConfirmName(""); }}
              className="border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting || deleteConfirmName !== deleteTarget?.field_name}
            >
              {deleting && <Loader2 className="size-3.5 animate-spin" />}
              Delete Field
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
